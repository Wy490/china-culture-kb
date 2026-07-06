import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createHmac } from 'node:crypto';
import {
  GEARS_CALLBACK_BATCH_ITEM_LIMIT,
  type StoryGenerateResult,
  type StoryProjectMeta,
  type StoryProjectVersionSnapshot,
} from '@shared/types.js';
import {
  acceptProjectLocalGearsArtifacts,
  addProjectMaterialPackMaterial,
  autoSelectProjectSeedanceShotVersions,
  buildProjectId,
  createProjectFromGeneratedStory,
  deleteProject,
  deleteProjects,
  draftProjectProductionMaterialFields,
  draftProjectSeedanceAssetPlaceholders,
  exportProjectCurrentVersion,
  exportProjectGearsExternalCallbackHandoff,
  exportProjectKnowledgeCandidates,
  exportProjectKnowledgeWritebackPatch,
  exportProjectKnowledgeWritebackQueuePatch,
  exportProjectProductionBoard,
  exportProjectSeedanceRetryPackage,
  getProject,
  getProjectSeedanceProviderQueueOverview,
  getProjectSeedanceProviderRetryPlan,
  getProjectProductionBoard,
  getProjectProductionReadiness,
  importProjectGearsCallback,
  importProjectGearsExternalCallbacks,
  importProjectGearsCallbacks,
  importProjectSeedanceAssetBatch,
  importProjectSeedanceProviderCallback,
  importProjectSeedanceShotCallbacks,
  listProjectSeedanceGlobalAssetLibrary,
  listProjects,
  listProjectSupplementTasks,
  pollProjectSeedanceProviderQueue,
  preflightProjectGearsExternalCallbacks,
  regenerateProjectScene,
  recoverProjectSeedanceProviderQueue,
  repairAndExportProjectProductionBoard,
  repairProjectProductionBoard,
  reuseProjectSeedanceAsset,
  retainRecentProjects,
  runProjectProductionReadinessAutomation,
  selectProjectSeedanceShotVersion,
  submitProjectGearsJobs,
  submitProjectSeedanceProviderRetryPlan,
  submitProjectSeedanceShotsToProvider,
  syncProjectGearsJobStatuses,
  updateProjectSeedanceAssetLibrary,
  updateProjectSeedanceShotStatus,
  updateProjectSeedanceShotStatuses,
  updateProjectCurrentGearsWebhookStatus,
  updateProjectSupplementTask,
  uploadProjectSeedanceAssetFile,
} from '../services/project-service.js';
import {
  getGearsExternalCallbackHandoffQueue,
  preflightGearsExternalCallbackBatch,
} from '../services/production-readiness-portfolio-service.js';
import { getProductionMaterialPack } from '../services/production-material-pack-service.js';
import { buildProductionMaterialReadinessReport } from '../services/production-material-readiness-service.js';

const TEMP_DIRS: string[] = [];
const ORIGINAL_KB_ROOT = process.env.KB_ROOT;
const ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_ENDPOINT = process.env.SEEDANCE_PROVIDER_SUBMIT_ENDPOINT;
const ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_API_TOKEN = process.env.SEEDANCE_PROVIDER_SUBMIT_API_TOKEN;
const ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_AUTH_HEADER = process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_HEADER;
const ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_AUTH_SCHEME = process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_SCHEME;
const ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_TIMEOUT_MS = process.env.SEEDANCE_PROVIDER_SUBMIT_TIMEOUT_MS;
const ORIGINAL_SEEDANCE_PROVIDER_CALLBACK_BASE_URL = process.env.SEEDANCE_PROVIDER_CALLBACK_BASE_URL;
const ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE = process.env.SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE;
const ORIGINAL_SEEDANCE_PROVIDER_PAYLOAD_MODE = process.env.SEEDANCE_PROVIDER_PAYLOAD_MODE;
const ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_PAYLOAD_MODE = process.env.SEEDANCE_PROVIDER_SUBMIT_PAYLOAD_MODE;
const ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_SECRET = process.env.SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_SECRET;
const ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_HEADER = process.env.SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_HEADER;
const ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_TIMESTAMP_HEADER = process.env.SEEDANCE_PROVIDER_SUBMIT_TIMESTAMP_HEADER;
const ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_MODEL = process.env.SEEDANCE_PROVIDER_SUBMIT_MODEL;
const ORIGINAL_SEEDANCE_PROVIDER_POLL_ENDPOINT = process.env.SEEDANCE_PROVIDER_POLL_ENDPOINT;
const ORIGINAL_SEEDANCE_PROVIDER_API_TOKEN = process.env.SEEDANCE_PROVIDER_API_TOKEN;
const ORIGINAL_SEEDANCE_PROVIDER_POLL_AUTH_HEADER = process.env.SEEDANCE_PROVIDER_POLL_AUTH_HEADER;
const ORIGINAL_SEEDANCE_PROVIDER_POLL_AUTH_SCHEME = process.env.SEEDANCE_PROVIDER_POLL_AUTH_SCHEME;
const ORIGINAL_SEEDANCE_PROVIDER_POLL_TIMEOUT_MS = process.env.SEEDANCE_PROVIDER_POLL_TIMEOUT_MS;
const ORIGINAL_SEEDANCE_PROVIDER_POLL_REQUEST_MODE = process.env.SEEDANCE_PROVIDER_POLL_REQUEST_MODE;
const ORIGINAL_SEEDANCE_PROVIDER_POLL_PAYLOAD_MODE = process.env.SEEDANCE_PROVIDER_POLL_PAYLOAD_MODE;
const ORIGINAL_SEEDANCE_PROVIDER_POLL_HTTP_METHOD = process.env.SEEDANCE_PROVIDER_POLL_HTTP_METHOD;
const ORIGINAL_SEEDANCE_PROVIDER_POLL_SIGNATURE_SECRET = process.env.SEEDANCE_PROVIDER_POLL_SIGNATURE_SECRET;
const ORIGINAL_SEEDANCE_PROVIDER_POLL_SIGNATURE_HEADER = process.env.SEEDANCE_PROVIDER_POLL_SIGNATURE_HEADER;
const ORIGINAL_SEEDANCE_PROVIDER_POLL_TIMESTAMP_HEADER = process.env.SEEDANCE_PROVIDER_POLL_TIMESTAMP_HEADER;
const ORIGINAL_GEARS_API_BASE_URL = process.env.GEARS_API_BASE_URL;
const ORIGINAL_GEARS_API_TOKEN = process.env.GEARS_API_TOKEN;
const ORIGINAL_GEARS_CALLBACK_BASE_URL = process.env.GEARS_CALLBACK_BASE_URL;

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

const DELIVERY_PROMPT_INTERNAL_PATTERN =
  /(质量信号|主角目标|目标明确|行动具体|因果链|史实边界|质量报告|来源说明|内部字段名|来源条目|来源显示|史实依据|影视化创作|知识库|用户大纲|生成优先级|资料显示|摘要|核心画面是|为什么必须面对|具体细节请核实来源|不可写成|确证史实|确证史源|创作边界|治理痕迹|分析|应该|注意|TODO|待补)/;

function expectProviderSignature(input: {
  init?: RequestInit;
  method: 'POST' | 'GET';
  endpoint: string;
  secret: string;
  signatureHeader: string;
  timestampHeader: string;
}): void {
  const headers = input.init?.headers as Record<string, string>;
  const timestamp = headers[input.timestampHeader];
  expect(timestamp).toBeTruthy();
  const bodyText = input.init?.body === undefined ? '' : String(input.init.body);
  const expected = `sha256=${createHmac('sha256', input.secret)
    .update([input.method, input.endpoint, timestamp, bodyText].join('\n'))
    .digest('hex')}`;
  expect(headers[input.signatureHeader]).toBe(expected);
}

function makeStory(): StoryGenerateResult {
  return {
    storyId: '20260609-story-abc1',
    title: '拒签冤案',
    generation_type: 'character_story',
    video_type: 'character_story',
    presentation_style: 'cinematic',
    source_entry: '周敦颐——理学开山鼻祖',
    logline: '在一纸判词前，他选择了良知。',
    theme: '人物故事',
    full_text: '第一场原文。\n\n第二场原文。',
    scene_breakdown: [
      {
        scene_id: 1,
        title: '雨夜开场',
        duration_sec: 30,
        location: '南安军衙',
        time_of_day: '雨夜',
        dramatic_function: '钩子开场',
        plot: '雨夜里，周敦颐看着案卷迟迟没有落笔。',
        key_action: '停笔凝视',
        characters: ['周敦颐'],
        visual_prompt: '烛火、案卷、未签的判词',
        camera_suggestion: '近景切入',
        cultural_note: '基于知识库条目',
        conflict: '签还是不签',
        dialogue_or_narration: '旁白：这一笔落下，就是一条命。',
        source_entries: ['周敦颐——理学开山鼻祖'],
      },
      {
        scene_id: 2,
        title: '正面交锋',
        duration_sec: 30,
        location: '军衙堂前',
        time_of_day: '白天',
        dramatic_function: '冲突升级',
        plot: '上官逼他签字，周敦颐却坚持重审。',
        key_action: '当面拒签',
        characters: ['周敦颐', '上官'],
        visual_prompt: '堂前对峙，案卷摊开',
        camera_suggestion: '中近景对切',
        cultural_note: '基于知识库条目',
        conflict: '权势与良知对撞',
        dialogue_or_narration: '周敦颐：此案有疑，我不能签。',
        source_entries: ['周敦颐——理学开山鼻祖'],
      },
    ],
    gears_segments: [
      {
        segment_id: 1,
        source_scene_id: 1,
        duration_sec: 30,
        panel_count: 6,
        script_text: '第一场分段',
        purpose: '钩子开场',
        visual_focus: ['南安军衙', '案卷'],
        cultural_constraints: ['基于知识库条目'],
        video_type: 'character_story',
        presentation_style: 'cinematic',
      },
      {
        segment_id: 2,
        source_scene_id: 2,
        duration_sec: 30,
        panel_count: 6,
        script_text: '第二场分段',
        purpose: '冲突升级',
        visual_focus: ['军衙堂前', '案卷'],
        cultural_constraints: ['基于知识库条目'],
        video_type: 'character_story',
        presentation_style: 'cinematic',
      },
    ],
    gears_segments_url: '/api/stories/20260609-story-abc1/gears-segments',
    cultural_constraints: ['基于知识库条目'],
    credibility_note: '基本可靠',
    story_structure: 'single_event_drama',
    model_profile_id: 'claude_sonnet',
    quality_report: {
      hasCentralEvent: true,
      hasConflict: true,
      hasProtagonistChoice: true,
      hasSceneAction: true,
      hasClimax: true,
      hasEndingTheme: true,
      isNotBiographySummary: true,
      passed: true,
      issues: [],
      video_type: 'character_story',
      story_structure: 'single_event_drama',
      genre_score: 92,
      missing_required_elements: [],
      weak_beats: [],
      forbidden_patterns_found: [],
      repair_actions: [],
    },
  };
}

afterEach(async () => {
  if (ORIGINAL_KB_ROOT === undefined) {
    delete process.env.KB_ROOT;
  } else {
    process.env.KB_ROOT = ORIGINAL_KB_ROOT;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_ENDPOINT === undefined) {
    delete process.env.SEEDANCE_PROVIDER_SUBMIT_ENDPOINT;
  } else {
    process.env.SEEDANCE_PROVIDER_SUBMIT_ENDPOINT = ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_ENDPOINT;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_API_TOKEN === undefined) {
    delete process.env.SEEDANCE_PROVIDER_SUBMIT_API_TOKEN;
  } else {
    process.env.SEEDANCE_PROVIDER_SUBMIT_API_TOKEN = ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_API_TOKEN;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_AUTH_HEADER === undefined) {
    delete process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_HEADER;
  } else {
    process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_HEADER = ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_AUTH_HEADER;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_AUTH_SCHEME === undefined) {
    delete process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_SCHEME;
  } else {
    process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_SCHEME = ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_AUTH_SCHEME;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_TIMEOUT_MS === undefined) {
    delete process.env.SEEDANCE_PROVIDER_SUBMIT_TIMEOUT_MS;
  } else {
    process.env.SEEDANCE_PROVIDER_SUBMIT_TIMEOUT_MS = ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_TIMEOUT_MS;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_CALLBACK_BASE_URL === undefined) {
    delete process.env.SEEDANCE_PROVIDER_CALLBACK_BASE_URL;
  } else {
    process.env.SEEDANCE_PROVIDER_CALLBACK_BASE_URL = ORIGINAL_SEEDANCE_PROVIDER_CALLBACK_BASE_URL;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE === undefined) {
    delete process.env.SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE;
  } else {
    process.env.SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE = ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_PAYLOAD_MODE === undefined) {
    delete process.env.SEEDANCE_PROVIDER_PAYLOAD_MODE;
  } else {
    process.env.SEEDANCE_PROVIDER_PAYLOAD_MODE = ORIGINAL_SEEDANCE_PROVIDER_PAYLOAD_MODE;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_PAYLOAD_MODE === undefined) {
    delete process.env.SEEDANCE_PROVIDER_SUBMIT_PAYLOAD_MODE;
  } else {
    process.env.SEEDANCE_PROVIDER_SUBMIT_PAYLOAD_MODE = ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_PAYLOAD_MODE;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_SECRET === undefined) {
    delete process.env.SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_SECRET;
  } else {
    process.env.SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_SECRET = ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_SECRET;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_HEADER === undefined) {
    delete process.env.SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_HEADER;
  } else {
    process.env.SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_HEADER = ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_HEADER;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_TIMESTAMP_HEADER === undefined) {
    delete process.env.SEEDANCE_PROVIDER_SUBMIT_TIMESTAMP_HEADER;
  } else {
    process.env.SEEDANCE_PROVIDER_SUBMIT_TIMESTAMP_HEADER = ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_TIMESTAMP_HEADER;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_MODEL === undefined) {
    delete process.env.SEEDANCE_PROVIDER_SUBMIT_MODEL;
  } else {
    process.env.SEEDANCE_PROVIDER_SUBMIT_MODEL = ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_MODEL;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_POLL_ENDPOINT === undefined) {
    delete process.env.SEEDANCE_PROVIDER_POLL_ENDPOINT;
  } else {
    process.env.SEEDANCE_PROVIDER_POLL_ENDPOINT = ORIGINAL_SEEDANCE_PROVIDER_POLL_ENDPOINT;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_API_TOKEN === undefined) {
    delete process.env.SEEDANCE_PROVIDER_API_TOKEN;
  } else {
    process.env.SEEDANCE_PROVIDER_API_TOKEN = ORIGINAL_SEEDANCE_PROVIDER_API_TOKEN;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_POLL_AUTH_HEADER === undefined) {
    delete process.env.SEEDANCE_PROVIDER_POLL_AUTH_HEADER;
  } else {
    process.env.SEEDANCE_PROVIDER_POLL_AUTH_HEADER = ORIGINAL_SEEDANCE_PROVIDER_POLL_AUTH_HEADER;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_POLL_AUTH_SCHEME === undefined) {
    delete process.env.SEEDANCE_PROVIDER_POLL_AUTH_SCHEME;
  } else {
    process.env.SEEDANCE_PROVIDER_POLL_AUTH_SCHEME = ORIGINAL_SEEDANCE_PROVIDER_POLL_AUTH_SCHEME;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_POLL_TIMEOUT_MS === undefined) {
    delete process.env.SEEDANCE_PROVIDER_POLL_TIMEOUT_MS;
  } else {
    process.env.SEEDANCE_PROVIDER_POLL_TIMEOUT_MS = ORIGINAL_SEEDANCE_PROVIDER_POLL_TIMEOUT_MS;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_POLL_REQUEST_MODE === undefined) {
    delete process.env.SEEDANCE_PROVIDER_POLL_REQUEST_MODE;
  } else {
    process.env.SEEDANCE_PROVIDER_POLL_REQUEST_MODE = ORIGINAL_SEEDANCE_PROVIDER_POLL_REQUEST_MODE;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_POLL_PAYLOAD_MODE === undefined) {
    delete process.env.SEEDANCE_PROVIDER_POLL_PAYLOAD_MODE;
  } else {
    process.env.SEEDANCE_PROVIDER_POLL_PAYLOAD_MODE = ORIGINAL_SEEDANCE_PROVIDER_POLL_PAYLOAD_MODE;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_POLL_HTTP_METHOD === undefined) {
    delete process.env.SEEDANCE_PROVIDER_POLL_HTTP_METHOD;
  } else {
    process.env.SEEDANCE_PROVIDER_POLL_HTTP_METHOD = ORIGINAL_SEEDANCE_PROVIDER_POLL_HTTP_METHOD;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_POLL_SIGNATURE_SECRET === undefined) {
    delete process.env.SEEDANCE_PROVIDER_POLL_SIGNATURE_SECRET;
  } else {
    process.env.SEEDANCE_PROVIDER_POLL_SIGNATURE_SECRET = ORIGINAL_SEEDANCE_PROVIDER_POLL_SIGNATURE_SECRET;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_POLL_SIGNATURE_HEADER === undefined) {
    delete process.env.SEEDANCE_PROVIDER_POLL_SIGNATURE_HEADER;
  } else {
    process.env.SEEDANCE_PROVIDER_POLL_SIGNATURE_HEADER = ORIGINAL_SEEDANCE_PROVIDER_POLL_SIGNATURE_HEADER;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_POLL_TIMESTAMP_HEADER === undefined) {
    delete process.env.SEEDANCE_PROVIDER_POLL_TIMESTAMP_HEADER;
  } else {
    process.env.SEEDANCE_PROVIDER_POLL_TIMESTAMP_HEADER = ORIGINAL_SEEDANCE_PROVIDER_POLL_TIMESTAMP_HEADER;
  }
  if (ORIGINAL_GEARS_API_BASE_URL === undefined) {
    delete process.env.GEARS_API_BASE_URL;
  } else {
    process.env.GEARS_API_BASE_URL = ORIGINAL_GEARS_API_BASE_URL;
  }
  if (ORIGINAL_GEARS_API_TOKEN === undefined) {
    delete process.env.GEARS_API_TOKEN;
  } else {
    process.env.GEARS_API_TOKEN = ORIGINAL_GEARS_API_TOKEN;
  }
  if (ORIGINAL_GEARS_CALLBACK_BASE_URL === undefined) {
    delete process.env.GEARS_CALLBACK_BASE_URL;
  } else {
    process.env.GEARS_CALLBACK_BASE_URL = ORIGINAL_GEARS_CALLBACK_BASE_URL;
  }
  vi.unstubAllGlobals();
  for (const dir of TEMP_DIRS.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe('project-service', () => {
  it('creates a real project and reads it back', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');

    expect(enriched.project_id).toBe(buildProjectId(story.storyId, story.video_type));
    expect(enriched.current_version_id).toContain('-v1');

    const detail = await getProject(enriched.project_id!);
    expect(detail.ok).toBe(true);
    expect(detail.data?.project.version_count).toBe(1);
    expect(detail.data?.project.open_supplement_task_count).toBe(0);
    expect(detail.data?.project.quality_passed).toBe(true);
    expect(detail.data?.project.genre_score).toBe(92);
    expect(detail.data?.project.quality_issue_count).toBe(0);
    expect(detail.data?.versions[0].quality_passed).toBe(true);
    expect(detail.data?.versions[0].genre_score).toBe(92);
    expect(detail.data?.current_story.title).toBe(story.title);
    expect(detail.data?.project.model_profile_id).toBe('claude_sonnet');
    expect(detail.data?.current_story.model_profile_id).toBe('claude_sonnet');

    const versionPath = resolve(
      root,
      'web',
      'generated',
      'projects',
      enriched.project_id!,
      'versions',
      `${enriched.current_version_id}.json`,
    );
    const snapshot = JSON.parse(await readFile(versionPath, 'utf-8')) as StoryProjectVersionSnapshot;
    expect(snapshot.quality_report?.genre_score).toBe(92);
    expect(snapshot.quality_report?.passed).toBe(true);
  });

  it('hydrates creation fields for legacy project metadata at read time', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const projectDir = resolve(root, 'web', 'generated', 'projects', enriched.project_id!);
    const rawMetaBefore = JSON.parse(await readFile(resolve(projectDir, 'project.json'), 'utf-8')) as StoryProjectMeta;
    expect(rawMetaBefore.creation_use_case).toBeUndefined();
    expect(rawMetaBefore.material_sufficiency).toBeUndefined();

    const listRes = await listProjects();
    expect(listRes.ok).toBe(true);
    const listed = listRes.data?.find(project => project.project_id === enriched.project_id);
    expect(listed?.creation_use_case).toBe('institutional_promo');
    expect(listed?.truth_mode).toBe('institutional_verified');
    expect(listed?.material_sufficiency?.schema_version).toBe('material-sufficiency/v1');

    const detail = await getProject(enriched.project_id!);
    expect(detail.ok).toBe(true);
    expect(detail.data?.project.creation_contract?.schema_version).toBe('creation-contract/v1');
    expect(detail.data?.current_story.material_pack?.schema_version).toBe('material-pack/v1');
    expect(detail.data?.current_story.creation_contract?.truth_mode).toBe('institutional_verified');

    const rawMetaAfter = JSON.parse(await readFile(resolve(projectDir, 'project.json'), 'utf-8')) as StoryProjectMeta;
    expect(rawMetaAfter.creation_use_case).toBeUndefined();
  });

  it('persists creation contract and material sufficiency in project metadata and version snapshots', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const materialSufficiency = {
      schema_version: 'material-sufficiency/v1' as const,
      stage: 'script_ready' as const,
      score: 86,
      can_generate: true,
      can_generate_with_risks: false,
      blocked: false,
      missing_items: [],
      optional_items: [],
      token_risk: 'low' as const,
      recommended_next_questions: [],
    };
    const creationContract = {
      schema_version: 'creation-contract/v1' as const,
      creation_use_case: 'institutional_promo' as const,
      truth_mode: 'institutional_verified' as const,
      client_type: '政府机构',
      target_audience: '青少年研学群体',
      communication_goal: '稳妥表达廉洁文化',
      video_type: 'character_story' as const,
      presentation_style: 'cinematic' as const,
      story_structure: 'single_event_drama' as const,
      narrative_pattern_ids: [],
      allowed_fiction: ['只允许镜头调度和非事实性视觉转场。'],
      must_verify: ['机构口径、数据和人物发言。'],
      forbidden_moves: ['虚构人物发言。'],
      required_disclaimers: ['必要时标注示意画面。'],
      material_sufficiency: materialSufficiency,
      delivery_expectation: ['前期剧本与生产指挥材料。'],
    };
    const story: StoryGenerateResult = {
      ...makeStory(),
      creation_use_case: 'institutional_promo',
      truth_mode: 'institutional_verified',
      client_type: '政府机构',
      target_audience: '青少年研学群体',
      communication_goal: '稳妥表达廉洁文化',
      material_sufficiency: materialSufficiency,
      creation_contract: creationContract,
      quality_report: {
        ...makeStory().quality_report!,
        truth_mode: 'institutional_verified',
        material_sufficiency_report: materialSufficiency,
      },
    };

    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:10:00.000Z');
    const projectDir = resolve(root, 'web', 'generated', 'projects', enriched.project_id!);
    const meta = JSON.parse(await readFile(resolve(projectDir, 'project.json'), 'utf-8')) as StoryProjectMeta;
    const snapshot = JSON.parse(
      await readFile(resolve(projectDir, 'versions', `${enriched.current_version_id}.json`), 'utf-8'),
    ) as StoryProjectVersionSnapshot;

    expect(meta.creation_use_case).toBe('institutional_promo');
    expect(meta.truth_mode).toBe('institutional_verified');
    expect(meta.material_sufficiency?.score).toBe(86);
    expect(meta.creation_contract?.client_type).toBe('政府机构');
    expect(snapshot.story.creation_contract?.truth_mode).toBe('institutional_verified');
    expect(snapshot.story.material_sufficiency?.stage).toBe('script_ready');
    expect(snapshot.quality_report?.truth_mode).toBe('institutional_verified');
  });

  it('skips unreadable project metadata when listing projects', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const brokenProjectDir = resolve(root, 'web', 'generated', 'projects', 'broken-project');
    await mkdir(brokenProjectDir, { recursive: true });
    await writeFile(resolve(brokenProjectDir, 'project.json'), '', 'utf-8');

    const res = await listProjects();

    expect(res.ok).toBe(true);
    expect(res.data?.map(project => project.project_id)).toEqual([enriched.project_id]);
  });

  it('rebuilds unreadable project metadata from source stories during migration', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const projectId = buildProjectId(story.storyId, story.video_type);
    const storyDir = resolve(root, 'web', 'generated', 'stories', story.video_type);
    await mkdir(storyDir, { recursive: true });
    await writeFile(
      resolve(storyDir, `${story.storyId}.json`),
      JSON.stringify({ ...story, _request_meta: { created_at: '2026-06-09T10:00:00.000Z' } }),
      'utf-8',
    );

    const brokenProjectDir = resolve(root, 'web', 'generated', 'projects', projectId);
    await mkdir(brokenProjectDir, { recursive: true });
    await writeFile(resolve(brokenProjectDir, 'project.json'), '', 'utf-8');

    const res = await listProjects();

    expect(res.ok).toBe(true);
    expect(res.data?.map(project => project.project_id)).toEqual([projectId]);
    const rebuilt = JSON.parse(await readFile(resolve(brokenProjectDir, 'project.json'), 'utf-8'));
    expect(rebuilt.title).toBe(story.title);
  });

  it('exports the current project version with markdown and marks the project exported', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const exportRes = await exportProjectCurrentVersion(enriched.project_id!);

    expect(exportRes.ok).toBe(true);
    expect(exportRes.data?.schema_version).toBe('story-project-export/v1');
    expect(exportRes.data?.project.status).toBe('exported');
    expect(exportRes.data?.summary.video_type_label).toBe('人物故事');
    expect(exportRes.data?.summary.genre_score).toBe(92);
    expect(exportRes.data?.summary.outline_coverage_score).toBe(100);
    expect(exportRes.data?.summary.pattern_quality_score).toBeGreaterThanOrEqual(0);
    expect(exportRes.data?.summary.gears_readiness_score).toBeGreaterThanOrEqual(0);
    expect(exportRes.data?.markdown).toContain('# 拒签冤案');
    expect(exportRes.data?.markdown).toContain('## 质量报告摘要');
    expect(exportRes.data?.markdown).toContain('## P0 可修复质量报告');
    expect(exportRes.data?.markdown).toContain('### Outline Coverage Report');
    expect(exportRes.data?.markdown).toContain('### Pattern Quality Report');
    expect(exportRes.data?.markdown).toContain('### GEARS Readiness Report');
    expect(exportRes.data?.markdown).toContain('## GEARS 分段');
    expect(exportRes.data?.story.storyId).toBe(story.storyId);

    const detail = await getProject(enriched.project_id!);
    expect(detail.ok).toBe(true);
    expect(detail.data?.project.status).toBe('exported');
  });

  it('builds a production board from the current project version', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const boardRes = await getProjectProductionBoard(enriched.project_id!);

    expect(boardRes.ok).toBe(true);
    expect(boardRes.data?.schema_version).toBe('story-production-board/v1');
    expect(boardRes.data?.project_id).toBe(enriched.project_id);
    expect(boardRes.data?.character_assets.length).toBeGreaterThan(0);
    expect(boardRes.data?.location_assets.length).toBeGreaterThan(0);
    expect(boardRes.data?.shot_units).toHaveLength(story.scene_breakdown.length);
    expect(boardRes.data?.shot_units[0]).toMatchObject({
      source_scene_id: 1,
      location: '南安军衙',
    });
    expect(boardRes.data?.shot_units[0].seedance_duration_sec).toBeGreaterThanOrEqual(4);
    expect(boardRes.data?.shot_units[0].seedance_duration_sec).toBeLessThanOrEqual(15);
    expect(boardRes.data?.shot_units[0].seedance_prompt).toContain('0-3秒');
    expect(boardRes.data?.shot_units[0].seedance_asset_slots.length).toBeGreaterThan(0);
    expect(boardRes.data?.shot_units[0].seedance_material_validation.prompt_complexity_score).toBeGreaterThan(0);
    expect(boardRes.data?.seedance_asset_report.total_asset_count).toBeGreaterThan(0);
    expect(boardRes.data?.seedance_asset_report.upload_required_count).toBeGreaterThan(0);
    expect(boardRes.data?.seedance_asset_report.shots[0].missing_asset_ids.length).toBeGreaterThan(0);
    expect(boardRes.data?.seedance_shot_ledger.schema_version).toBe('seedance-shot-ledger/v1');
    expect(boardRes.data?.seedance_shot_ledger.items).toHaveLength(story.scene_breakdown.length);
    expect(boardRes.data?.seedance_shot_ledger.items[0]).toMatchObject({
      shot_id: 'shot-1',
      status: 'prompt_exported',
      retry_count: 0,
    });
    expect(boardRes.data?.supervision_report.issue_count).toBeGreaterThan(0);
    expect(boardRes.data?.supervision_report.priority_fixes.length).toBeGreaterThan(0);
    expect(boardRes.data?.repair_plan.task_count).toBeGreaterThan(0);
    expect(boardRes.data?.repair_plan.tasks.map(task => task.action)).toContain('add_continuity');
    expect(boardRes.data?.delivery_manifest.stage).toBe('needs_repair');
    expect(boardRes.data?.delivery_manifest.artifacts.map(artifact => artifact.kind)).toContain('seedance_prompts');
    expect(boardRes.data?.delivery_manifest.artifacts.map(artifact => artifact.kind)).toContain('seedance_asset_report');
    expect(boardRes.data?.delivery_manifest.artifacts.map(artifact => artifact.kind)).toContain('seedance_shot_ledger');
    expect(boardRes.data?.qa_report.score).toBeGreaterThanOrEqual(0);
    expect(boardRes.data?.qa_report.issues.some(issue => issue.includes('连续性约束不足'))).toBe(true);
    expect(boardRes.data?.markdown).toContain('## 镜头单元');
    expect(boardRes.data?.markdown).toContain('## 监督检查');
    expect(boardRes.data?.markdown).toContain('## 生产修复包');
    expect(boardRes.data?.markdown).toContain('## 交付清单');
    expect(boardRes.data?.markdown).toContain('## Seedance 素材缺口');
    expect(boardRes.data?.markdown).toContain('## Seedance Shot Ledger');
    expect(boardRes.data?.markdown).toContain('Seedance');
    expect(boardRes.data?.markdown).toContain('Seedance 素材 slot');

    const bindableAsset = boardRes.data!.seedance_asset_report.assets.find(asset => asset.status === 'missing_file');
    expect(bindableAsset).toBeTruthy();
    const updateRes = await updateProjectSeedanceAssetLibrary(enriched.project_id!, {
      items: [{
        asset_id: bindableAsset!.asset_id,
        kind: bindableAsset!.kind,
        label: bindableAsset!.label,
        modality: bindableAsset!.modality,
        role: bindableAsset!.role,
        reference_slot: bindableAsset!.reference_slot,
        file_url: 'https://example.com/seedance-assets/asset-001.png',
        description: '测试绑定素材',
      }],
    });
    expect(updateRes.ok).toBe(true);
    expect(updateRes.data?.project.seedance_asset_library?.items[0]).toMatchObject({
      asset_id: bindableAsset!.asset_id,
      file_url: 'https://example.com/seedance-assets/asset-001.png',
      history: [expect.objectContaining({
        event_type: 'manual_bind',
        file_url: 'https://example.com/seedance-assets/asset-001.png',
      })],
    });
    const boundBoardRes = await getProjectProductionBoard(enriched.project_id!);
    expect(boundBoardRes.ok).toBe(true);
    expect(boundBoardRes.data?.seedance_asset_report.assets.find(asset =>
      asset.asset_id === bindableAsset!.asset_id
    )).toMatchObject({
      status: 'bound',
      is_bound: true,
      needs_upload: false,
      file_url: 'https://example.com/seedance-assets/asset-001.png',
    });
    const batchAsset = boundBoardRes.data!.seedance_asset_report.assets.find(asset => asset.status === 'missing_file');
    expect(batchAsset).toBeTruthy();
    const batchImportRes = await importProjectSeedanceAssetBatch(enriched.project_id!, {
      source_note: '测试批量导入素材清单',
      items: [{
        asset_id: batchAsset!.asset_id,
        provider: 'seedance',
        provider_asset_id: 'seedance-provider-asset-002',
        upload_status: 'uploaded',
        local_path: '/tmp/seedance-assets/asset-002.png',
      }, {
        asset_id: 'missing-asset',
        upload_status: 'pending_upload',
      }],
    });
    expect(batchImportRes.ok).toBe(true);
    expect(batchImportRes.data?.imported_count).toBe(1);
    expect(batchImportRes.data?.matched_existing_count).toBe(1);
    expect(batchImportRes.data?.skipped_count).toBe(1);
    expect(batchImportRes.data?.updated_asset_ids).toContain(batchAsset!.asset_id);
    expect(batchImportRes.data?.detail.project.seedance_asset_library?.items.find(asset =>
      asset.asset_id === batchAsset!.asset_id
    )?.history).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event_type: 'batch_import',
        provider_asset_id: 'seedance-provider-asset-002',
        note: '测试批量导入素材清单',
      }),
    ]));
    const batchBoardRes = await getProjectProductionBoard(enriched.project_id!);
    expect(batchBoardRes.ok).toBe(true);
    expect(batchBoardRes.data?.seedance_asset_report.assets.find(asset =>
      asset.asset_id === batchAsset!.asset_id
    )).toMatchObject({
      status: 'bound',
      is_bound: true,
      needs_upload: false,
      provider: 'seedance',
      provider_asset_id: 'seedance-provider-asset-002',
      upload_status: 'uploaded',
    });
    const uploadAsset = batchBoardRes.data!.seedance_asset_report.assets.find(asset => asset.status === 'missing_file');
    expect(uploadAsset).toBeTruthy();
    const uploadRes = await uploadProjectSeedanceAssetFile(enriched.project_id!, {
      asset_id: uploadAsset!.asset_id,
      label: uploadAsset!.label,
      kind: uploadAsset!.kind,
      modality: uploadAsset!.modality,
      role: uploadAsset!.role,
      reference_slot: uploadAsset!.reference_slot,
      description: uploadAsset!.prompt_usage,
      file: {
        original_filename: 'seedance-upload-test.png',
        mime_type: 'image/png',
        buffer: Buffer.from('seedance-upload-binary'),
      },
    });
    expect(uploadRes.ok).toBe(true);
    expect(uploadRes.data?.asset).toMatchObject({
      asset_id: uploadAsset!.asset_id,
      original_filename: 'seedance-upload-test.png',
      mime_type: 'image/png',
      size_bytes: Buffer.from('seedance-upload-binary').length,
      provider: 'local_upload',
      upload_status: 'uploaded',
      history: [expect.objectContaining({
        event_type: 'file_upload',
        original_filename: 'seedance-upload-test.png',
      })],
    });
    expect(uploadRes.data?.local_path).toContain(`projects/${enriched.project_id}/seedance-assets/uploads/`);
    const uploadedFilePath = resolve(root, 'web', 'generated', uploadRes.data!.local_path);
    expect(await readFile(uploadedFilePath, 'utf-8')).toBe('seedance-upload-binary');
    const uploadBoardRes = await getProjectProductionBoard(enriched.project_id!);
    expect(uploadBoardRes.ok).toBe(true);
    expect(uploadBoardRes.data?.seedance_asset_report.assets.find(asset =>
      asset.asset_id === uploadAsset!.asset_id
    )).toMatchObject({
      status: 'bound',
      is_bound: true,
      needs_upload: false,
      provider: 'local_upload',
      upload_status: 'uploaded',
      original_filename: 'seedance-upload-test.png',
    });

    const targetStory: StoryGenerateResult = {
      ...story,
      storyId: '20260609-story-reuse',
      title: '拒签冤案复用目标',
      gears_segments_url: '/api/stories/20260609-story-reuse/gears-segments',
    };
    const targetProject = await createProjectFromGeneratedStory(targetStory, '2026-06-09T10:30:00.000Z');
    const globalLibraryRes = await listProjectSeedanceGlobalAssetLibrary(targetProject.project_id!);
    expect(globalLibraryRes.ok).toBe(true);
    const reusableAsset = globalLibraryRes.data?.items.find(asset =>
      asset.source_project_id === enriched.project_id && asset.source_asset_id === uploadAsset!.asset_id
    );
    expect(reusableAsset).toMatchObject({
      provider: 'local_upload',
      upload_status: 'uploaded',
      original_filename: 'seedance-upload-test.png',
    });
    const targetBoardRes = await getProjectProductionBoard(targetProject.project_id!);
    const targetAsset = targetBoardRes.data?.seedance_asset_report.assets.find(asset =>
      asset.asset_id === uploadAsset!.asset_id
    );
    expect(targetAsset).toMatchObject({
      status: 'missing_file',
      is_bound: false,
    });
    const reuseRes = await reuseProjectSeedanceAsset(targetProject.project_id!, {
      source_project_id: enriched.project_id!,
      source_asset_id: uploadAsset!.asset_id,
      target_asset_id: targetAsset!.asset_id,
      target_label: targetAsset!.label,
      target_kind: targetAsset!.kind,
      reference_slot: targetAsset!.reference_slot,
      description: targetAsset!.prompt_usage,
    });
    expect(reuseRes.ok).toBe(true);
    expect(reuseRes.data?.reused_asset).toMatchObject({
      asset_id: targetAsset!.asset_id,
      label: targetAsset!.label,
      provider: 'local_upload',
      upload_status: 'uploaded',
      original_filename: 'seedance-upload-test.png',
      history: [expect.objectContaining({
        event_type: 'cross_project_reuse',
        source_project_id: enriched.project_id,
        source_asset_id: uploadAsset!.asset_id,
      })],
    });
    const reusedBoardRes = await getProjectProductionBoard(targetProject.project_id!);
    expect(reusedBoardRes.data?.seedance_asset_report.assets.find(asset =>
      asset.asset_id === targetAsset!.asset_id
    )).toMatchObject({
      status: 'bound',
      is_bound: true,
      needs_upload: false,
      provider: 'local_upload',
      upload_status: 'uploaded',
      original_filename: 'seedance-upload-test.png',
    });

    const shotStatusRes = await updateProjectSeedanceShotStatus(enriched.project_id!, {
      shot_id: 'shot-1',
      status: 'ready',
      provider_job_id: 'seedance-job-001',
      video_url: 'https://example.com/seedance-videos/shot-1.mp4',
      quality_score: 88,
      review_note: '回片可用',
      note: '测试回片',
    });
    expect(shotStatusRes.ok).toBe(true);
    expect(shotStatusRes.data?.project.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-1'
    )).toMatchObject({
      status: 'ready',
      provider_job_id: 'seedance-job-001',
      video_url: 'https://example.com/seedance-videos/shot-1.mp4',
      retry_count: 0,
      selected_version_id: 'seedance-shot-shot-1-v1',
    });
    const shotBoardRes = await getProjectProductionBoard(enriched.project_id!);
    expect(shotBoardRes.data?.seedance_shot_ledger.items.find(item =>
      item.shot_id === 'shot-1'
    )?.versions[0]).toMatchObject({
      status: 'ready',
      provider_job_id: 'seedance-job-001',
      video_url: 'https://example.com/seedance-videos/shot-1.mp4',
      quality_score: 88,
      review_note: '回片可用',
    });

    const submittedRes = await updateProjectSeedanceShotStatus(enriched.project_id!, {
      shot_id: 'shot-2',
      status: 'submitted',
      provider_job_id: 'seedance-job-002',
      note: '提交第二镜头',
    });
    expect(submittedRes.ok).toBe(true);

    const importRes = await importProjectSeedanceShotCallbacks(enriched.project_id!, {
      callbacks: [{
        job_id: 'seedance-job-002',
        status: 'success',
        url: 'https://example.com/seedance-videos/shot-2.mp4',
        qualityScore: 92,
        reviewNote: '导入回片可用',
        message: '平台回传成功',
      }],
    });
    expect(importRes.ok).toBe(true);
    expect(importRes.data?.updated_count).toBe(1);
    expect(importRes.data?.failed_count).toBe(0);
    expect(importRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-2'
    )).toMatchObject({
      status: 'ready',
      provider_job_id: 'seedance-job-002',
      video_url: 'https://example.com/seedance-videos/shot-2.mp4',
      selected_version_id: 'seedance-shot-shot-2-v2',
    });

    const failedRes = await updateProjectSeedanceShotStatus(enriched.project_id!, {
      shot_id: 'shot-2',
      status: 'failed',
      provider_job_id: 'seedance-job-003',
      failure_reason: '人物手部变形',
      increment_retry: true,
      note: '重试失败',
    });
    expect(failedRes.ok).toBe(true);
    const retryPackageRes = await exportProjectSeedanceRetryPackage(enriched.project_id!);
    expect(retryPackageRes.ok).toBe(true);
    expect(retryPackageRes.data?.schema_version).toBe('story-seedance-retry-package/v1');
    expect(retryPackageRes.data?.total_retry_shot_count).toBe(1);
    expect(retryPackageRes.data?.skipped_ready_shot_count).toBe(1);
    expect(retryPackageRes.data?.shots[0]).toMatchObject({
      shot_id: 'shot-2',
      status: 'failed',
      failure_reason: '人物手部变形',
      provider_job_id: 'seedance-job-003',
      retry_count: 1,
    });
    expect(retryPackageRes.data?.shots[0].prompt.seedance_prompt).toContain('0-3秒');
    expect(retryPackageRes.data?.markdown).toContain('Seedance 重试提交包');
    expect(retryPackageRes.data?.markdown).toContain('人物手部变形');

    const providerSubmitRes = await submitProjectSeedanceShotsToProvider(enriched.project_id!, {
      shot_ids: ['shot-2'],
      provider: 'seedance',
      job_prefix: 'seedance-provider-submit-test',
      queue_id: 'seedance-provider-queue-test-001',
      queue_priority: 'high',
      note: '测试 provider 提交',
    });
    expect(providerSubmitRes.ok).toBe(true);
    expect(providerSubmitRes.data?.submitted_count).toBe(1);
    expect(providerSubmitRes.data?.skipped_count).toBe(0);
    expect(providerSubmitRes.data?.provider_queue_batch).toMatchObject({
      queue_id: 'seedance-provider-queue-test-001',
      provider: 'seedance',
      priority: 'high',
      submitted_count: 1,
      skipped_count: 0,
      failed_count: 0,
      items: [{
        shot_id: 'shot-2',
        provider_job_id: 'seedance-provider-submit-test-shot-2',
        queue_position: 1,
        status: 'submitted',
      }],
    });
    expect(providerSubmitRes.data?.project.seedance_provider_queue).toMatchObject({
      schema_version: 'seedance-provider-queue/v1',
      latest_queue_id: 'seedance-provider-queue-test-001',
    });
    expect(providerSubmitRes.data?.submitted_shots[0]).toMatchObject({
      shot_id: 'shot-2',
      provider_job_id: 'seedance-provider-submit-test-shot-2',
      provider_queue_id: 'seedance-provider-queue-test-001',
      provider_queue_position: 1,
      status: 'submitted',
    });
    expect(providerSubmitRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-2'
    )).toMatchObject({
      status: 'submitted',
      provider: 'seedance',
      provider_job_id: 'seedance-provider-submit-test-shot-2',
      provider_queue_id: 'seedance-provider-queue-test-001',
      provider_queue_position: 1,
      retry_count: 2,
    });
    const providerSubmitAgainRes = await submitProjectSeedanceShotsToProvider(enriched.project_id!, {
      shot_ids: ['shot-2'],
      provider: 'seedance',
      job_prefix: 'seedance-provider-submit-again',
    });
    expect(providerSubmitAgainRes.ok).toBe(true);
    expect(providerSubmitAgainRes.data?.submitted_count).toBe(0);
    expect(providerSubmitAgainRes.data?.skipped_count).toBe(1);

    const projectFile = resolve(root, 'web', 'generated', 'projects', enriched.project_id!, 'project.json');
    const staleProject = JSON.parse(await readFile(projectFile, 'utf8')) as StoryProjectMeta;
    staleProject.seedance_shot_ledger = {
      ...staleProject.seedance_shot_ledger!,
      items: staleProject.seedance_shot_ledger!.items.map(item =>
        item.shot_id === 'shot-2'
          ? {
              ...item,
              submitted_at: '2026-06-09T10:00:00.000Z',
              updated_at: '2026-06-09T10:00:00.000Z',
            }
          : item
      ),
    };
    await writeFile(projectFile, JSON.stringify(staleProject, null, 2));
    const providerRecoveryDryRunRes = await recoverProjectSeedanceProviderQueue(enriched.project_id!, {
      timeout_minutes: 60,
    });
    expect(providerRecoveryDryRunRes.ok).toBe(true);
    expect(providerRecoveryDryRunRes.data).toMatchObject({
      dry_run: true,
      timeout_minutes: 60,
      checked_count: 1,
      timed_out_count: 1,
      updated_count: 0,
      timed_out_shots: [{
        shot_id: 'shot-2',
        provider_job_id: 'seedance-provider-submit-test-shot-2',
        provider_queue_id: 'seedance-provider-queue-test-001',
      }],
    });
    const providerRecoveryRes = await recoverProjectSeedanceProviderQueue(enriched.project_id!, {
      timeout_minutes: 60,
      mark_timed_out_failed: true,
      note: '测试 provider 超时恢复',
    });
    expect(providerRecoveryRes.ok).toBe(true);
    expect(providerRecoveryRes.data).toMatchObject({
      dry_run: false,
      timed_out_count: 1,
      updated_count: 1,
    });
    expect(providerRecoveryRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-2'
    )).toMatchObject({
      status: 'failed',
      provider_job_id: 'seedance-provider-submit-test-shot-2',
      provider_queue_id: 'seedance-provider-queue-test-001',
      failure_reason: 'Provider task timed out after 60 minutes',
    });

    const selectRes = await selectProjectSeedanceShotVersion(enriched.project_id!, {
      shot_id: 'shot-2',
      version_id: 'seedance-shot-shot-2-v2',
      note: '人工选择第二版',
    });
    expect(selectRes.ok).toBe(true);
    const selectedShotTwo = selectRes.data?.project.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-2'
    );
    expect(selectedShotTwo).toMatchObject({
      status: 'ready',
      video_url: 'https://example.com/seedance-videos/shot-2.mp4',
      selected_version_id: 'seedance-shot-shot-2-v2',
    });
    expect(selectedShotTwo?.failure_reason).toBeUndefined();

    const betterVersionRes = await updateProjectSeedanceShotStatus(enriched.project_id!, {
      shot_id: 'shot-2',
      status: 'ready',
      provider_job_id: 'seedance-job-004',
      video_url: 'https://example.com/seedance-videos/shot-2-v4.mp4',
      quality_score: 98,
      review_note: '自动择优候选',
      note: '更高分回片',
    });
    expect(betterVersionRes.ok).toBe(true);
    expect(betterVersionRes.data?.project.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-2'
    )?.selected_version_id).toBe('seedance-shot-shot-2-v2');

    const protectedAutoSelectRes = await autoSelectProjectSeedanceShotVersions(enriched.project_id!, {
      min_quality_score: 95,
    });
    expect(protectedAutoSelectRes.ok).toBe(true);
    expect(protectedAutoSelectRes.data?.project.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-2'
    )?.selected_version_id).toBe('seedance-shot-shot-2-v2');

    const autoSelectRes = await autoSelectProjectSeedanceShotVersions(enriched.project_id!, {
      min_quality_score: 95,
      overwrite_manual: true,
      note: '覆盖人工选择进行自动择优',
    });
    expect(autoSelectRes.ok).toBe(true);
    expect(autoSelectRes.data?.project.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-2'
    )).toMatchObject({
      status: 'ready',
      video_url: 'https://example.com/seedance-videos/shot-2-v4.mp4',
      selected_version_id: 'seedance-shot-shot-2-v6',
    });

    const batchRes = await updateProjectSeedanceShotStatuses(enriched.project_id!, {
      updates: [
        { shot_id: 'shot-1', status: 'processing', note: '批量标记处理中' },
        { shot_id: 'missing-shot', status: 'failed', failure_reason: '不存在的镜头' },
      ],
    });
    expect(batchRes.ok).toBe(true);
    expect(batchRes.data).toMatchObject({
      updated_count: 1,
      failed_count: 1,
    });
    expect(batchRes.data?.failures[0]).toMatchObject({
      index: 1,
      shot_id: 'missing-shot',
    });
    expect(batchRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-1'
    )).toMatchObject({
      status: 'processing',
    });
  });

  it('drafts local Seedance placeholder assets and clears asset binding gaps', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const beforeBoard = await getProjectProductionBoard(enriched.project_id!);
    expect(beforeBoard.ok).toBe(true);
    expect(beforeBoard.data?.seedance_asset_report.upload_required_count).toBeGreaterThan(0);
    expect(beforeBoard.data?.seedance_asset_report.unbound_shot_count).toBeGreaterThan(0);

    const beforeReadiness = await getProjectProductionReadiness(enriched.project_id!);
    expect(beforeReadiness.ok).toBe(true);
    expect(beforeReadiness.data?.issues.map(issue => issue.issue_id)).toContain('seedance-assets-unbound');
    expect(beforeReadiness.data?.next_actions.map(action => action.action_key)).toContain('draft_seedance_asset_placeholders');
    expect(beforeReadiness.data?.automation_plan.steps.find(step =>
      step.action_key === 'draft_seedance_asset_placeholders'
    )).toMatchObject({
      runner: 'story_agent_api',
      mode: 'writes_project',
      can_auto_execute: true,
      api: {
        method: 'POST',
        path: `/api/projects/${enriched.project_id}/production-board/seedance-assets/draft-placeholders`,
      },
    });

    const draftRes = await draftProjectSeedanceAssetPlaceholders(enriched.project_id!);
    expect(draftRes.ok).toBe(true);
    expect(draftRes.data?.schema_version).toBe('project-seedance-asset-placeholders/v1');
    expect(draftRes.data?.created_count).toBeGreaterThan(0);
    expect(draftRes.data?.before_upload_required_count).toBeGreaterThan(0);
    expect(draftRes.data?.after_upload_required_count).toBe(0);
    expect(draftRes.data?.after_unbound_shot_count).toBe(0);
    expect(draftRes.data?.board.seedance_asset_report.assets.every(asset => asset.status === 'bound')).toBe(true);

    const firstItem = draftRes.data!.items[0];
    const placeholderFilePath = resolve(root, 'web', 'generated', firstItem.local_path);
    const placeholderFile = await readFile(placeholderFilePath, 'utf-8');
    expect(placeholderFile).toContain('<svg');
    expect(placeholderFile).toContain(firstItem.label);
    expect((await stat(placeholderFilePath)).size).toBe(firstItem.size_bytes);

    const libraryAsset = draftRes.data?.detail.project.seedance_asset_library?.items.find(asset =>
      asset.asset_id === firstItem.asset_id
    );
    expect(libraryAsset).toMatchObject({
      asset_id: firstItem.asset_id,
      local_path: firstItem.local_path,
      provider: 'story_agent_placeholder',
      upload_status: 'uploaded',
      mime_type: 'image/svg+xml',
      history: [expect.objectContaining({
        event_type: 'placeholder_draft',
        local_path: firstItem.local_path,
      })],
    });

    const exportedReport = JSON.parse(await readFile(
      resolve(root, 'web', 'generated', 'projects', enriched.project_id!, 'production-board', 'seedance-asset-report.json'),
      'utf-8',
    )) as { upload_required_count: number; unbound_shot_count: number };
    expect(exportedReport.upload_required_count).toBe(0);
    expect(exportedReport.unbound_shot_count).toBe(0);

    const afterReadiness = await getProjectProductionReadiness(enriched.project_id!);
    expect(afterReadiness.ok).toBe(true);
    expect(afterReadiness.data?.issues.map(issue => issue.issue_id)).not.toContain('seedance-assets-unbound');
    expect(afterReadiness.data?.next_actions.map(action => action.action_key)).not.toContain('draft_seedance_asset_placeholders');
  });

  it('builds a project production readiness report across quality, board, and GEARS ledgers', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');

    const initialReadiness = await getProjectProductionReadiness(enriched.project_id!);

    expect(initialReadiness.ok).toBe(true);
    expect(initialReadiness.data?.schema_version).toBe('story-project-production-readiness/v1');
    expect(initialReadiness.data?.scope).toBe('story_project');
    expect(initialReadiness.data?.summary.quality_score).toBe(92);
    expect(initialReadiness.data?.summary.gears_job_count).toBe(0);
    expect(initialReadiness.data?.lanes.map(lane => lane.key)).toContain('story_quality');
    expect(initialReadiness.data?.lanes.map(lane => lane.key)).toContain('production_board');
    expect(initialReadiness.data?.issues.map(issue => issue.issue_id)).toContain('gears-ledger-empty');
    expect(initialReadiness.data?.next_actions.map(action => action.action_key)).toContain('submit_gears_jobs');
    expect(initialReadiness.data?.automation_plan.schema_version).toBe('production-readiness-automation-plan/v1');
    const submitStep = initialReadiness.data?.automation_plan.steps.find(step => step.action_key === 'submit_gears_jobs');
    expect(submitStep).toMatchObject({
      runner: 'gears_worker',
      mode: 'external_execution',
      can_auto_execute: false,
      api: {
        method: 'POST',
        path: `/api/projects/${enriched.project_id}/production-board/gears-jobs/submit`,
      },
    });
    expect(initialReadiness.data?.markdown).toContain('制作 readiness');
    expect(initialReadiness.data?.markdown).toContain('Automation Plan');

    const dryRun = await runProjectProductionReadinessAutomation(enriched.project_id!, {
      dry_run: true,
      action_keys: ['export_production_board'],
    });
    expect(dryRun.ok).toBe(true);
    expect(dryRun.data?.planned_step_count).toBe(1);
    expect(dryRun.data?.executed_step_count).toBe(0);

    const automationRun = await runProjectProductionReadinessAutomation(enriched.project_id!, {
      dry_run: false,
      action_keys: ['export_production_board'],
    });
    expect(automationRun.ok).toBe(true);
    expect(automationRun.data?.executed_step_count).toBe(1);
    expect(automationRun.data?.steps[0]).toMatchObject({
      action_key: 'export_production_board',
      status: 'executed',
    });
    expect(automationRun.data?.after_readiness.project.current_version_id).toBe(enriched.current_version_id);
    expect(automationRun.data?.after_readiness.latest_automation_run).toMatchObject({
      scope: 'story_project',
      project_id: enriched.project_id,
      dry_run: false,
      executed_step_count: 1,
      failed_step_count: 0,
    });
    expect(automationRun.data?.after_readiness.automation_ledger?.total_run_count).toBe(1);
    expect(automationRun.data?.after_readiness.markdown).toContain('Latest Automation Run');

    const afterAutomationReadiness = await getProjectProductionReadiness(enriched.project_id!);
    expect(afterAutomationReadiness.data?.latest_automation_run?.steps[0]).toMatchObject({
      action_key: 'export_production_board',
      status: 'executed',
    });

    const submitRes = await submitProjectGearsJobs(enriched.project_id!, {
      job_type: 'seedance_video',
      note: 'readiness test submit',
    });
    expect(submitRes.ok).toBe(true);
    expect(submitRes.data?.submitted_count).toBeGreaterThan(0);

    const afterSubmit = await getProjectProductionReadiness(enriched.project_id!);
    const gearsLane = afterSubmit.data?.lanes.find(lane => lane.key === 'gears_execution');

    expect(afterSubmit.ok).toBe(true);
    expect(afterSubmit.data?.summary.gears_job_count).toBeGreaterThan(0);
    expect(afterSubmit.data?.summary.active_gears_job_count).toBeGreaterThan(0);
    expect(gearsLane?.status).toBe('needs_action');
    expect(afterSubmit.data?.next_actions.map(action => action.action_key)).toContain('accept_local_gears_artifacts');
    expect(afterSubmit.data?.next_actions.map(action => action.action_key)).not.toContain('sync_gears_jobs');
    expect(afterSubmit.data?.automation_plan.steps.find(step =>
      step.action_key === 'accept_local_gears_artifacts'
    )).toMatchObject({
      mode: 'manual',
      can_auto_execute: false,
      api: {
        method: 'POST',
        path: `/api/projects/${enriched.project_id}/production-board/gears-jobs/local-acceptance`,
      },
    });
    expect(afterSubmit.data?.markdown).toContain('GEARS Execution');

    const localAcceptance = await acceptProjectLocalGearsArtifacts(enriched.project_id!, {
      job_type: 'seedance_video',
      note: 'local acceptance test artifact; not external provider output',
    });
    expect(localAcceptance.ok).toBe(true);
    expect(localAcceptance.data?.accepted_count).toBe(submitRes.data?.submitted_count);
    expect(localAcceptance.data?.accepted_jobs.every(job => job.status === 'ready')).toBe(true);
    expect(localAcceptance.data?.accepted_jobs.every(job =>
      job.artifacts?.some(artifact =>
        artifact.role === 'local_acceptance'
        && artifact.metadata?.not_external_provider_output === true
      )
    )).toBe(true);
    expect(localAcceptance.data?.seedance_shot_ledger?.items.every(item =>
      item.status === 'ready'
      && item.video_url?.startsWith('https://local.story-agent.invalid/gears-acceptance/')
    )).toBe(true);

    const afterLocalAcceptance = await getProjectProductionReadiness(enriched.project_id!);
    const acceptedGearsLane = afterLocalAcceptance.data?.lanes.find(lane => lane.key === 'gears_execution');
    expect(afterLocalAcceptance.ok).toBe(true);
    expect(afterLocalAcceptance.data?.summary.active_gears_job_count).toBe(0);
    expect(afterLocalAcceptance.data?.summary.external_ready_gears_job_count).toBe(0);
    expect(afterLocalAcceptance.data?.summary.local_acceptance_ready_gears_job_count).toBe(submitRes.data?.submitted_count);
    expect(afterLocalAcceptance.data?.summary.ready_without_external_gears_artifact_count).toBe(submitRes.data?.submitted_count);
    expect(acceptedGearsLane?.status).toBe('ready');
    expect(acceptedGearsLane?.evidence).toContain(`local_acceptance_ready ${submitRes.data?.submitted_count}`);
    expect(afterLocalAcceptance.data?.issues.find(issue =>
      issue.issue_id === 'gears-local-acceptance-only'
    )).toMatchObject({
      severity: 'info',
      lane_key: 'gears_execution',
    });
    expect(afterLocalAcceptance.data?.next_actions.map(action => action.action_key)).not.toContain('accept_local_gears_artifacts');
    expect(afterLocalAcceptance.data?.next_actions.map(action => action.action_key)).not.toContain('sync_gears_jobs');
    expect(afterLocalAcceptance.data?.next_actions.map(action => action.action_key)).toContain('export_gears_external_callback_handoff');
    expect(afterLocalAcceptance.data?.automation_plan.steps.find(step =>
      step.action_key === 'export_gears_external_callback_handoff'
    )).toMatchObject({
      runner: 'operator_review',
      mode: 'manual',
      can_auto_execute: false,
      api: {
        method: 'POST',
        path: `/api/projects/${enriched.project_id}/production-board/gears-jobs/export-external-callback-handoff`,
      },
    });

    const firstAcceptedJob = localAcceptance.data?.accepted_jobs[0];
    expect(firstAcceptedJob).toBeTruthy();
    process.env.GEARS_CALLBACK_BASE_URL = 'https://story.example.test/public/';
    const expectedCallbackPath = `/api/projects/${enriched.project_id}/gears-callback`;
    const expectedPreflightPath = `/api/projects/${enriched.project_id}/production-board/gears-jobs/preflight-external-callbacks`;
    const expectedSafeImportPath = `/api/projects/${enriched.project_id}/production-board/gears-jobs/import-external-callbacks`;
    const expectedCallbackUrl = `https://story.example.test/public${expectedCallbackPath}`;
    const expectedPreflightUrl = `https://story.example.test/public${expectedPreflightPath}`;
    const expectedSafeImportUrl = `https://story.example.test/public${expectedSafeImportPath}`;
    const handoffBeforeExternal = await exportProjectGearsExternalCallbackHandoff(enriched.project_id!);
    expect(handoffBeforeExternal.ok).toBe(true);
    expect(handoffBeforeExternal.data).toMatchObject({
      schema_version: 'project-gears-external-callback-handoff/v1',
      pending_external_artifact_count: submitRes.data?.submitted_count,
      local_acceptance_ready_count: submitRes.data?.submitted_count,
      external_ready_count: 0,
      callback_path: expectedCallbackPath,
      callback_url: expectedCallbackUrl,
      preflight_path: expectedPreflightPath,
      preflight_url: expectedPreflightUrl,
      safe_import_path: expectedSafeImportPath,
      safe_import_url: expectedSafeImportUrl,
    });
    expect(handoffBeforeExternal.data?.items).toHaveLength(submitRes.data?.submitted_count ?? 0);
    expect(handoffBeforeExternal.data?.items[0]).toMatchObject({
      source_unit_id: firstAcceptedJob!.source_unit_id,
      gears_job_id: firstAcceptedJob!.gears_job_id,
      requires_external_artifact: true,
      callback_path: expectedCallbackPath,
      callback_url: expectedCallbackUrl,
      callback_sample: {
        jobId: firstAcceptedJob!.gears_job_id,
        sourceUnitId: firstAcceptedJob!.source_unit_id,
        jobType: 'seedance_video',
        taskStatus: 'COMPLETED',
      },
    });
    expect(handoffBeforeExternal.data?.items[0].local_acceptance_artifact_urls[0]).toContain('https://local.story-agent.invalid/gears-acceptance/');
    expect(handoffBeforeExternal.data?.items[0].external_artifact_urls).toEqual([]);
    expect(handoffBeforeExternal.data?.items[0].callback_sample.outputUrl).toContain('https://gears.example/videos/');
    expect(handoffBeforeExternal.data?.items[0].prompt?.seedance_prompt).toContain('0-3秒');
    expect(handoffBeforeExternal.data?.callback_batch_sample.callbacks).toHaveLength(submitRes.data?.submitted_count ?? 0);
    expect(handoffBeforeExternal.data?.callback_batch_sample.callbacks[0]).toMatchObject({
      sourceUnitId: firstAcceptedJob!.source_unit_id,
      outputUrl: expect.stringContaining('https://gears.example/videos/'),
    });
    expect(handoffBeforeExternal.data?.callback_batch_sample.replace_before_import).toEqual(expect.arrayContaining([
      expect.stringContaining('outputUrl'),
      expect.stringContaining('absolute public http(s) URL'),
    ]));
    expect(handoffBeforeExternal.data?.callback_batch_sample.import_note).toContain('safe external callback import endpoint');
    expect(handoffBeforeExternal.data?.callback_batch_preflight_curl).toContain(expectedPreflightUrl);
    expect(handoffBeforeExternal.data?.callback_batch_preflight_curl).not.toContain('GEARS_CALLBACK_SECRET');
    expect(handoffBeforeExternal.data?.callback_batch_curl).toContain(expectedSafeImportUrl);
    expect(handoffBeforeExternal.data?.callback_batch_curl).not.toContain('GEARS_CALLBACK_SECRET');
    expect(handoffBeforeExternal.data?.operator_checklist).toEqual(expect.arrayContaining([
      expect.stringContaining('preflight endpoint'),
      expect.stringContaining('safe import endpoint'),
      expect.stringContaining('absolute public http(s) outputUrl'),
    ]));
    expect(handoffBeforeExternal.data?.markdown).toContain('GEARS 外部回片交接包');
    expect(handoffBeforeExternal.data?.markdown).toContain('## 批量回传 payload');
    expect(handoffBeforeExternal.data?.markdown).toContain('preflightPath');
    expect(handoffBeforeExternal.data?.markdown).toContain('Preflight curl');
    expect(handoffBeforeExternal.data?.markdown).toContain('Safe import curl');
    expect(handoffBeforeExternal.data?.markdown).toContain('safeImportPath');
    expect(handoffBeforeExternal.data?.markdown).toContain('curl -sS -X POST');
    expect(handoffBeforeExternal.data?.markdown).toContain('local_acceptance URL 只代表本地链路验收');
    expect(handoffBeforeExternal.data?.markdown).toContain('"outputUrl"');

    const globalHandoffQueue = await getGearsExternalCallbackHandoffQueue({ limit: 10 });
    expect(globalHandoffQueue.schema_version).toBe('gears-external-callback-handoff-queue/v1');
    expect(globalHandoffQueue.project_count).toBeGreaterThanOrEqual(1);
    expect(globalHandoffQueue.pending_external_artifact_count).toBeGreaterThanOrEqual(submitRes.data?.submitted_count ?? 1);
    expect(globalHandoffQueue.callback_sample_count).toBeGreaterThanOrEqual(submitRes.data?.submitted_count ?? 1);
    expect(globalHandoffQueue.callback_sample_placeholder_output_url_count).toBeGreaterThanOrEqual(submitRes.data?.submitted_count ?? 1);
    expect(globalHandoffQueue.callback_sample_ready_for_import_count).toBe(0);
    expect(globalHandoffQueue.callback_sample_invalid_output_url_count).toBe(0);
    expect(globalHandoffQueue.sample_payload_ready_for_import).toBe(false);
    expect(globalHandoffQueue.projects.some(project =>
      project.project_id === enriched.project_id
      && project.pending_external_artifact_count === submitRes.data?.submitted_count
      && project.safe_import_path === expectedSafeImportPath
    )).toBe(true);
    expect(globalHandoffQueue.callback_batch_sample.callbacks.some(callback =>
      callback.jobId === firstAcceptedJob!.gears_job_id
    )).toBe(true);
    expect(globalHandoffQueue.system_preflight_curl).toContain('/api/system/gears-external-callbacks/preflight');
    expect(globalHandoffQueue.system_preflight_curl).toContain('$GEARS_CALLBACK_SECRET');
    expect(globalHandoffQueue.system_safe_import_curl).toContain('/api/system/gears-external-callbacks/import');
    expect(globalHandoffQueue.system_safe_import_curl).toContain('@gears-system-external-callbacks.json');
    expect(globalHandoffQueue.markdown).toContain('GEARS External Callback Handoff Queue');
    expect(globalHandoffQueue.markdown).toContain('## System Commands');
    expect(globalHandoffQueue.markdown).toContain(globalHandoffQueue.system_preflight_curl);
    expect(globalHandoffQueue.markdown).toContain('callback sample ready/total: 0/');
    expect(globalHandoffQueue.markdown).toContain('Do not treat local_acceptance artifacts as final external media.');

    const placeholderPreflight = await preflightProjectGearsExternalCallbacks(enriched.project_id!, handoffBeforeExternal.data!.callback_batch_sample);
    expect(placeholderPreflight.ok).toBe(true);
    expect(placeholderPreflight.data).toMatchObject({
      schema_version: 'project-gears-external-callback-preflight/v1',
      received_count: submitRes.data?.submitted_count,
      ready_to_import_count: 0,
      duplicate_event_count: 0,
    });
    expect(placeholderPreflight.data?.blocking_count).toBeGreaterThan(0);
    expect(placeholderPreflight.data?.issues.map(issue => issue.code)).toContain('placeholder_artifact_url');
    expect(placeholderPreflight.data?.markdown).toContain('GEARS 外部回片 preflight');
    const blockedImport = await importProjectGearsExternalCallbacks(enriched.project_id!, handoffBeforeExternal.data!.callback_batch_sample);
    expect(blockedImport.ok).toBe(true);
    expect(blockedImport.data).toMatchObject({
      schema_version: 'project-gears-external-callback-import/v1',
      blocked: true,
      received_count: submitRes.data?.submitted_count,
      updated_count: 0,
      failed_count: submitRes.data?.submitted_count,
      duplicate_count: 0,
    });

    const realExternalPayload = {
      callbacks: handoffBeforeExternal.data!.callback_batch_sample.callbacks.map((callback, index) => ({
        ...callback,
        outputUrl: `https://media.story-agent.test/external-shot-${index + 1}.mp4`,
        eventId: `external-ready-shot-${index + 1}`,
      })),
    };
    const realPreflight = await preflightProjectGearsExternalCallbacks(enriched.project_id!, realExternalPayload);
    expect(realPreflight.ok).toBe(true);
    expect(realPreflight.data).toMatchObject({
      received_count: submitRes.data?.submitted_count,
      ready_to_import_count: submitRes.data?.submitted_count,
      duplicate_event_count: 0,
      blocking_count: 0,
    });
    expect(realPreflight.data?.items[0]).toMatchObject({
      has_event_id: true,
      would_update: true,
    });
    const { eventId: omittedEventId, ...missingEventIdCallback } = realExternalPayload.callbacks[0];
    expect(omittedEventId).toBe('external-ready-shot-1');
    const missingEventIdPreflight = await preflightProjectGearsExternalCallbacks(enriched.project_id!, {
      callbacks: [missingEventIdCallback],
    });
    expect(missingEventIdPreflight.ok).toBe(true);
    expect(missingEventIdPreflight.data).toMatchObject({
      received_count: 1,
      ready_to_import_count: 1,
      duplicate_event_count: 0,
      blocking_count: 0,
      warning_count: 1,
    });
    expect(missingEventIdPreflight.data?.issues.map(issue => issue.code)).toContain('missing_event_id');
    expect(missingEventIdPreflight.data?.items[0]).toMatchObject({
      has_event_id: false,
      is_duplicate_event: false,
      would_update: true,
    });
    const privateArtifactPreflight = await preflightProjectGearsExternalCallbacks(enriched.project_id!, {
      callbacks: [{
        ...realExternalPayload.callbacks[0],
        outputUrl: 'http://127.0.0.1:9000/external-shot-1.mp4',
        eventId: 'external-private-shot-1',
      }],
    });
    expect(privateArtifactPreflight.ok).toBe(true);
    expect(privateArtifactPreflight.data).toMatchObject({
      received_count: 1,
      ready_to_import_count: 0,
      duplicate_event_count: 0,
      blocking_count: 2,
    });
    expect(privateArtifactPreflight.data?.issues.map(issue => issue.code)).toEqual(expect.arrayContaining([
      'missing_external_artifact_url',
      'private_or_local_artifact_url',
    ]));
    expect(privateArtifactPreflight.data?.items[0]).toMatchObject({
      has_external_artifact_url: false,
      has_private_or_local_artifact_url: true,
      has_invalid_artifact_url: false,
      would_update: false,
    });
    const invalidArtifactPreflight = await preflightProjectGearsExternalCallbacks(enriched.project_id!, {
      callbacks: [{
        ...realExternalPayload.callbacks[0],
        outputUrl: '/tmp/external-shot-1.mp4',
        eventId: 'external-invalid-url-shot-1',
      }],
    });
    expect(invalidArtifactPreflight.ok).toBe(true);
    expect(invalidArtifactPreflight.data).toMatchObject({
      received_count: 1,
      ready_to_import_count: 0,
      duplicate_event_count: 0,
      blocking_count: 2,
    });
    expect(invalidArtifactPreflight.data?.issues.map(issue => issue.code)).toEqual(expect.arrayContaining([
      'missing_external_artifact_url',
      'invalid_artifact_url',
    ]));
    expect(invalidArtifactPreflight.data?.items[0]).toMatchObject({
      has_external_artifact_url: false,
      has_private_or_local_artifact_url: false,
      has_invalid_artifact_url: true,
      would_update: false,
    });
    const duplicateBatchPreflight = await preflightProjectGearsExternalCallbacks(enriched.project_id!, {
      callbacks: [
        realExternalPayload.callbacks[0],
        realExternalPayload.callbacks[0],
      ],
    });
    expect(duplicateBatchPreflight.ok).toBe(true);
    expect(duplicateBatchPreflight.data).toMatchObject({
      received_count: 2,
      ready_to_import_count: 1,
      duplicate_event_count: 1,
      blocking_count: 0,
      warning_count: 1,
    });
    expect(duplicateBatchPreflight.data?.issues.map(issue => issue.code)).toContain('duplicate_event_id_in_batch');
    expect(duplicateBatchPreflight.data?.items[1]).toMatchObject({
      event_id: 'external-ready-shot-1',
      is_duplicate_event: true,
      duplicate_event_source: 'batch',
      duplicate_of_index: 0,
      would_update: false,
    });
    const systemPlaceholderPreflight = await preflightGearsExternalCallbackBatch(handoffBeforeExternal.data!.callback_batch_sample);
    expect(systemPlaceholderPreflight).toMatchObject({
      schema_version: 'system-gears-external-callback-batch-import/v1',
      mode: 'preflight',
      blocked: true,
      received_count: submitRes.data?.submitted_count,
      resolved_count: submitRes.data?.submitted_count,
      unresolved_count: 0,
      project_count: 1,
      ready_to_import_count: 0,
      updated_count: 0,
    });
    expect(systemPlaceholderPreflight.blocking_count).toBeGreaterThan(0);
    expect(systemPlaceholderPreflight.project_results[0]).toMatchObject({
      project_id: enriched.project_id,
      blocked: true,
      preflight: {
        blocking_count: expect.any(Number),
      },
    });
    expect(systemPlaceholderPreflight.markdown).toContain('GEARS External Callback Batch Import');
    const systemRealPreflight = await preflightGearsExternalCallbackBatch(realExternalPayload);
    expect(systemRealPreflight).toMatchObject({
      schema_version: 'system-gears-external-callback-batch-import/v1',
      mode: 'preflight',
      blocked: false,
      received_count: submitRes.data?.submitted_count,
      resolved_count: submitRes.data?.submitted_count,
      unresolved_count: 0,
      project_count: 1,
      ready_to_import_count: submitRes.data?.submitted_count,
      updated_count: 0,
      failed_count: 0,
      blocking_count: 0,
    });
    expect(systemRealPreflight.project_results[0]).toMatchObject({
      project_id: enriched.project_id,
      preflight: {
        ready_to_import_count: submitRes.data?.submitted_count,
      },
    });
    const externalCallbackRes = await importProjectGearsExternalCallbacks(enriched.project_id!, {
      callbacks: [{
        jobId: firstAcceptedJob!.gears_job_id,
        sourceUnitId: firstAcceptedJob!.source_unit_id,
        jobType: 'seedance_video',
        taskStatus: 'COMPLETED',
        outputUrl: 'https://media.story-agent.test/external-shot-1.mp4',
        eventId: 'external-ready-shot-1',
        note: 'external provider callback replaces local acceptance',
      }],
    });
    expect(externalCallbackRes.ok).toBe(true);
    expect(externalCallbackRes.data?.blocked).toBe(false);
    expect(externalCallbackRes.data?.import_result?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === firstAcceptedJob!.source_unit_id
    )).toMatchObject({
      status: 'ready',
      video_url: 'https://media.story-agent.test/external-shot-1.mp4',
    });
    const duplicateLedgerPreflight = await preflightProjectGearsExternalCallbacks(enriched.project_id!, {
      callbacks: [realExternalPayload.callbacks[0]],
    });
    expect(duplicateLedgerPreflight.ok).toBe(true);
    expect(duplicateLedgerPreflight.data).toMatchObject({
      received_count: 1,
      ready_to_import_count: 0,
      duplicate_event_count: 1,
      blocking_count: 0,
      warning_count: 1,
    });
    expect(duplicateLedgerPreflight.data?.issues.map(issue => issue.code)).toContain('duplicate_callback_event');
    expect(duplicateLedgerPreflight.data?.items[0]).toMatchObject({
      event_id: 'external-ready-shot-1',
      is_duplicate_event: true,
      duplicate_event_source: 'ledger',
      would_update: false,
    });

    const afterExternalCallback = await getProjectProductionReadiness(enriched.project_id!);
    const externalGearsLane = afterExternalCallback.data?.lanes.find(lane => lane.key === 'gears_execution');
    expect(afterExternalCallback.ok).toBe(true);
    expect(afterExternalCallback.data?.summary.external_ready_gears_job_count).toBe(1);
    expect(afterExternalCallback.data?.summary.local_acceptance_ready_gears_job_count).toBe((submitRes.data?.submitted_count ?? 1) - 1);
    expect(afterExternalCallback.data?.summary.ready_without_external_gears_artifact_count).toBe((submitRes.data?.submitted_count ?? 1) - 1);
    expect(externalGearsLane?.status).toBe('ready');
    expect(externalGearsLane?.evidence).toContain('external_ready 1');
    expect(afterExternalCallback.data?.next_actions.map(action => action.action_key)).toContain('export_gears_external_callback_handoff');

    const handoffAfterExternal = await exportProjectGearsExternalCallbackHandoff(enriched.project_id!);
    expect(handoffAfterExternal.ok).toBe(true);
    expect(handoffAfterExternal.data?.pending_external_artifact_count).toBe((submitRes.data?.submitted_count ?? 1) - 1);
    expect(handoffAfterExternal.data?.callback_batch_sample.callbacks).toHaveLength((submitRes.data?.submitted_count ?? 1) - 1);
    expect(handoffAfterExternal.data?.external_ready_count).toBe(1);
    expect(handoffAfterExternal.data?.items.some(item =>
      item.source_unit_id === firstAcceptedJob!.source_unit_id
    )).toBe(false);
  });

  it('keeps internal labels out of GEARS payload summaries and project ledgers', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const baseStory = makeStory();
    const story: StoryGenerateResult = {
      ...baseStory,
      scene_breakdown: baseStory.scene_breakdown.map(scene => scene.scene_id === 1
        ? {
            ...scene,
            location: '南安军衙，来源显示：知识库；生成优先级：高',
            dialogue_or_narration: '旁白：这一笔落下，就是一条命。史实依据：知识库条目；质量信号：目标明确',
          }
        : scene),
    };
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const submitRes = await submitProjectGearsJobs(enriched.project_id!, {
      job_type: 'seedance_video',
      source_unit_ids: ['shot-1'],
      note: 'GEARS local submit smoke',
    });

    expect(submitRes.ok).toBe(true);
    const submittedSummary = submitRes.data?.submitted_jobs[0]?.payload_summary ?? '';
    expect(submittedSummary).toContain('南安军衙');
    expect(submittedSummary).toContain('第一场分段');
    expect(submittedSummary).not.toMatch(DELIVERY_PROMPT_INTERNAL_PATTERN);

    const detail = await getProject(enriched.project_id!);
    const ledgerSummary = detail.data?.project.gears_job_ledger?.items.find(item =>
      item.job_type === 'seedance_video' && item.source_unit_id === 'shot-1'
    )?.payload_summary ?? '';
    expect(ledgerSummary).toBe(submittedSummary);
    expect(ledgerSummary).not.toMatch(DELIVERY_PROMPT_INTERNAL_PATTERN);
  });

  it('cleans legacy GEARS payload summaries when exporting the production board', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const projectPath = resolve(root, 'web', 'generated', 'projects', enriched.project_id!, 'project.json');
    const project = JSON.parse(await readFile(projectPath, 'utf-8')) as StoryProjectMeta;
    const dirtySummary = '南安军衙，生成优先级：剧情推进与资料完整保持均衡，关键知识点必须进入可观看的场景行动。第一场分段';
    project.gears_job_ledger = {
      schema_version: 'gears-job-ledger/v1',
      updated_at: '2026-06-09T10:01:00.000Z',
      items: [{
        ledger_id: 'legacy-ledger-shot-1',
        gears_job_id: 'legacy-gears-job-shot-1',
        job_type: 'seedance_video',
        source_unit_id: 'shot-1',
        source_project_id: enriched.project_id,
        source_story_id: story.storyId,
        idempotency_key: 'seedance_video:shot-1',
        status: 'submitted',
        artifact_urls: [],
        submitted_at: '2026-06-09T10:01:00.000Z',
        updated_at: '2026-06-09T10:01:00.000Z',
        payload_summary: dirtySummary,
      }],
    };
    await writeFile(projectPath, JSON.stringify(project, null, 2), 'utf-8');

    const exportRes = await exportProjectProductionBoard(enriched.project_id!);
    expect(exportRes.ok).toBe(true);

    const updatedProject = JSON.parse(await readFile(projectPath, 'utf-8')) as StoryProjectMeta;
    const summary = updatedProject.gears_job_ledger?.items[0]?.payload_summary ?? '';
    expect(summary).toContain('南安军衙');
    expect(summary).toContain('第一场分段');
    expect(summary).not.toMatch(DELIVERY_PROMPT_INTERNAL_PATTERN);
    expect(summary).not.toContain('关键知识点必须进入可观看的场景行动');
  });

  it('submits GEARS jobs locally and applies callbacks to the project ledgers', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const submitRes = await submitProjectGearsJobs(enriched.project_id!, {
      job_type: 'seedance_video',
      source_unit_ids: ['shot-1'],
      note: 'GEARS local submit smoke',
    });

    expect(submitRes.ok).toBe(true);
    expect(submitRes.data).toMatchObject({
      submitted_count: 1,
      skipped_count: 0,
      failed_count: 0,
      provider_adapter: {
        status: 'mocked',
        accepted_count: 1,
      },
    });
    const job = submitRes.data?.submitted_jobs[0];
    expect(job).toMatchObject({
      job_type: 'seedance_video',
      source_unit_id: 'shot-1',
      idempotency_key: 'seedance_video:shot-1',
      status: 'submitted',
      source_project_id: enriched.project_id,
      source_story_id: story.storyId,
    });
    expect(submitRes.data?.seedance_shot_ledger?.items.find(item => item.shot_id === 'shot-1')).toMatchObject({
      status: 'submitted',
      provider: 'gears',
      provider_job_id: job?.gears_job_id,
    });

    const gearsCallbackPayload = {
      data: {
        task: {
          task_id: job!.gears_job_id,
          external_id: 'shot-1',
          jobType: 'seedance_video',
          taskStatus: 'completed',
          output: {
            files: [{
              mediaUrl: 'https://gears.example/videos/shot-1.mp4',
              mediaType: 'video',
              mimeType: 'video/mp4',
            }],
          },
          eventId: 'gears-event-001',
          message: 'GEARS completed',
          progressPercent: '100%',
          eventTime: '2026-06-20T10:00:00.000Z',
          completedAt: '2026-06-20T10:01:00.000Z',
          qualityScore: 96,
          reviewNote: 'GEARS 回片可用',
        },
      },
    };
    const callbackRes = await importProjectGearsCallback(enriched.project_id!, gearsCallbackPayload);

    expect(callbackRes.ok).toBe(true);
    expect(callbackRes.data).toMatchObject({
      received_count: 1,
      updated_count: 1,
      failed_count: 0,
      duplicate_count: 0,
      gears_job_id: job?.gears_job_id,
      source_unit_id: 'shot-1',
      status: 'ready',
    });
    expect(callbackRes.data?.gears_job_ledger?.items.find(item => item.source_unit_id === 'shot-1')).toMatchObject({
      status: 'ready',
      progress_percent: 100,
      completed_at: '2026-06-20T10:01:00.000Z',
      artifact_urls: ['https://gears.example/videos/shot-1.mp4'],
      callback_events: [expect.objectContaining({
        event_id: 'gears-event-001',
        provider_event_at: '2026-06-20T10:00:00.000Z',
        status: 'ready',
      })],
    });
    expect(callbackRes.data?.seedance_shot_ledger?.items.find(item => item.shot_id === 'shot-1')).toMatchObject({
      status: 'ready',
      provider: 'gears',
      provider_job_id: job?.gears_job_id,
      video_url: 'https://gears.example/videos/shot-1.mp4',
      selected_version_id: 'seedance-shot-shot-1-v2',
    });

    const duplicateCallbackRes = await importProjectGearsCallback(enriched.project_id!, gearsCallbackPayload);
    expect(duplicateCallbackRes.ok).toBe(true);
    expect(duplicateCallbackRes.data).toMatchObject({
      received_count: 1,
      updated_count: 1,
      failed_count: 0,
      duplicate_count: 1,
    });
    const duplicateGearsItem = duplicateCallbackRes.data?.gears_job_ledger?.items.find(item =>
      item.source_unit_id === 'shot-1'
    );
    expect(duplicateGearsItem?.callback_events?.filter(event => event.event_id === 'gears-event-001')).toHaveLength(1);
    expect(duplicateCallbackRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-1'
    )?.versions.filter(version => version.video_url === 'https://gears.example/videos/shot-1.mp4')).toHaveLength(1);

    const staleCallbackRes = await importProjectGearsCallback(enriched.project_id!, {
      jobId: job!.gears_job_id,
      sourceUnitId: 'shot-1',
      jobType: 'seedance_video',
      taskStatus: 'PROCESSING',
      progress: 0.5,
      eventId: 'gears-event-stale-processing',
      message: 'late GEARS processing webhook',
    });
    expect(staleCallbackRes.ok).toBe(true);
    expect(staleCallbackRes.data).toMatchObject({
      received_count: 1,
      updated_count: 1,
      failed_count: 0,
      duplicate_count: 0,
      status: 'ready',
    });
    const staleGearsItem = staleCallbackRes.data?.gears_job_ledger?.items.find(item =>
      item.source_unit_id === 'shot-1'
    );
    expect(staleGearsItem).toMatchObject({
      status: 'ready',
      progress_percent: 100,
      artifact_urls: ['https://gears.example/videos/shot-1.mp4'],
    });
    expect(staleGearsItem?.callback_events?.find(event =>
      event.event_id === 'gears-event-stale-processing'
    )).toMatchObject({
      status: 'processing',
      applied_status: 'ready',
      status_regression_ignored: true,
      progress_percent: 50,
    });
    expect(staleCallbackRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-1'
    )).toMatchObject({
      status: 'ready',
      video_url: 'https://gears.example/videos/shot-1.mp4',
    });
    expect(staleCallbackRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-1'
    )?.versions.filter(version => version.video_url === 'https://gears.example/videos/shot-1.mp4')).toHaveLength(1);

    const terminalConflictRes = await importProjectGearsCallback(enriched.project_id!, {
      jobId: job!.gears_job_id,
      sourceUnitId: 'shot-1',
      jobType: 'seedance_video',
      taskStatus: 'FAILED',
      eventId: 'gears-event-terminal-failed-after-ready',
      failureReason: 'GEARS later marked artifact invalid',
      errorCode: 'ARTIFACT_INVALID',
      completedAt: '2026-06-20T10:02:00.000Z',
    });
    expect(terminalConflictRes.ok).toBe(true);
    expect(terminalConflictRes.data).toMatchObject({
      received_count: 1,
      updated_count: 1,
      failed_count: 0,
      duplicate_count: 0,
      status: 'failed',
    });
    const terminalConflictItem = terminalConflictRes.data?.gears_job_ledger?.items.find(item =>
      item.source_unit_id === 'shot-1'
    );
    expect(terminalConflictItem).toMatchObject({
      status: 'failed',
      completed_at: '2026-06-20T10:02:00.000Z',
      artifact_urls: ['https://gears.example/videos/shot-1.mp4'],
      error_code: 'ARTIFACT_INVALID',
      failure_reason: 'GEARS later marked artifact invalid',
    });
    expect(terminalConflictItem?.callback_events?.find(event =>
      event.event_id === 'gears-event-terminal-failed-after-ready'
    )).toMatchObject({
      previous_status: 'ready',
      status: 'failed',
      applied_status: 'failed',
      terminal_status_changed: true,
    });
    expect(terminalConflictRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-1'
    )).toMatchObject({
      status: 'failed',
      video_url: 'https://gears.example/videos/shot-1.mp4',
      failure_reason: 'GEARS later marked artifact invalid',
    });

    const canceledCallbackRes = await importProjectGearsCallback(enriched.project_id!, {
      jobId: job!.gears_job_id,
      sourceUnitId: 'shot-1',
      jobType: 'seedance_video',
      taskStatus: 'CANCELED',
      eventId: 'gears-event-canceled-with-reason',
      failureReason: 'GEARS operator canceled the task',
      errorCode: 'MANUAL_CANCEL',
    });
    expect(canceledCallbackRes.ok).toBe(true);
    expect(canceledCallbackRes.data).toMatchObject({
      received_count: 1,
      updated_count: 1,
      failed_count: 0,
      duplicate_count: 0,
      status: 'canceled',
    });
    const canceledGearsItem = canceledCallbackRes.data?.gears_job_ledger?.items.find(item =>
      item.source_unit_id === 'shot-1'
    );
    expect(canceledGearsItem).toMatchObject({
      status: 'canceled',
      error_code: 'MANUAL_CANCEL',
      failure_reason: 'GEARS operator canceled the task',
      failure_category: 'unknown',
    });
    expect(canceledGearsItem?.callback_events?.find(event =>
      event.event_id === 'gears-event-canceled-with-reason'
    )).toMatchObject({
      previous_status: 'failed',
      status: 'canceled',
      applied_status: 'canceled',
      terminal_status_changed: true,
    });
    expect(canceledCallbackRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-1'
    )).toMatchObject({
      status: 'failed',
      failure_reason: 'GEARS operator canceled the task',
      provider_error_code: 'MANUAL_CANCEL',
    });
  });

  it('imports batched project GEARS callbacks into the project ledgers', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const submitRes = await submitProjectGearsJobs(enriched.project_id!, {
      job_type: 'seedance_video',
      source_unit_ids: ['shot-1', 'shot-2'],
      note: 'GEARS batch callback setup',
    });
    expect(submitRes.ok).toBe(true);
    const jobs = submitRes.data!.submitted_jobs;

    const callbackRes = await importProjectGearsCallbacks(enriched.project_id!, {
      callbacks: [
        ...jobs.map((job, index) => ({
          jobId: job.gears_job_id,
          sourceUnitId: job.source_unit_id,
          jobType: 'seedance_video' as const,
          taskStatus: 'COMPLETED',
          outputUrl: `https://gears.example/videos/batch-shot-${index + 1}.mp4`,
        })),
        {
          jobType: 'seedance_video',
          taskStatus: 'COMPLETED',
          outputUrl: 'https://gears.example/videos/missing-id.mp4',
        },
      ],
    });

    expect(callbackRes.ok).toBe(true);
    expect(callbackRes.data).toMatchObject({
      received_count: 3,
      updated_count: 2,
      failed_count: 1,
      duplicate_count: 0,
      failures: [{
        index: 2,
        path: 'callbacks[2]',
        message: expect.stringContaining('requires a known gears_job_id, source_unit_id, or idempotency_key'),
      }],
    });
    expect(callbackRes.data?.seedance_shot_ledger?.items.find(item => item.shot_id === 'shot-1')).toMatchObject({
      status: 'ready',
      provider_job_id: jobs[0].gears_job_id,
      video_url: 'https://gears.example/videos/batch-shot-1.mp4',
    });
    expect(callbackRes.data?.seedance_shot_ledger?.items.find(item => item.shot_id === 'shot-2')).toMatchObject({
      status: 'ready',
      provider_job_id: jobs[1].gears_job_id,
      video_url: 'https://gears.example/videos/batch-shot-2.mp4',
    });
  });

  it('rejects oversized project GEARS callback batches before project lookup', async () => {
    const callbacks = Array.from({ length: GEARS_CALLBACK_BATCH_ITEM_LIMIT + 1 }, (_, index) => ({
      jobId: `gears-project-too-many-${index}`,
      sourceUnitId: `shot-${index}`,
      jobType: 'seedance_video' as const,
      taskStatus: 'COMPLETED',
    }));

    const result = await importProjectGearsCallbacks('20260617-story-missing--ai_comic_drama', { callbacks });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('VALIDATION_ERROR');
    expect(result.error?.message).toContain(`GEARS callback batch item count must be <= ${GEARS_CALLBACK_BATCH_ITEM_LIMIT}`);
  });

  it('matches project GEARS callbacks by source id aliases when platform job id changes', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const submitRes = await submitProjectGearsJobs(enriched.project_id!, {
      job_type: 'seedance_video',
      source_unit_ids: ['shot-1'],
      note: 'GEARS source id alias submit smoke',
    });
    expect(submitRes.ok).toBe(true);
    const originalJob = submitRes.data!.submitted_jobs[0];

    const callbackRes = await importProjectGearsCallback(enriched.project_id!, {
      jobId: 'gears-platform-remapped-job-001',
      customId: 'shot-1',
      jobType: 'seedance_video',
      taskStatus: 'COMPLETED',
      videoUrl: 'https://gears.example/videos/custom-id-shot-1.mp4',
      eventId: 'gears-custom-id-event-001',
    });

    expect(callbackRes.ok).toBe(true);
    expect(callbackRes.data).toMatchObject({
      received_count: 1,
      updated_count: 1,
      failed_count: 0,
      source_unit_id: 'shot-1',
      gears_job_id: 'gears-platform-remapped-job-001',
      status: 'ready',
    });
    expect(callbackRes.data?.gears_job_ledger?.items.find(item => item.source_unit_id === 'shot-1')).toMatchObject({
      status: 'ready',
      gears_job_id: 'gears-platform-remapped-job-001',
      artifact_urls: ['https://gears.example/videos/custom-id-shot-1.mp4'],
      callback_events: [expect.objectContaining({
        event_id: 'gears-custom-id-event-001',
        status: 'ready',
      })],
    });
    expect(callbackRes.data?.seedance_shot_ledger?.items.find(item => item.shot_id === 'shot-1')).toMatchObject({
      status: 'ready',
      provider: 'gears',
      provider_job_id: 'gears-platform-remapped-job-001',
      video_url: 'https://gears.example/videos/custom-id-shot-1.mp4',
    });
    expect(originalJob.gears_job_id).not.toBe('gears-platform-remapped-job-001');
  });

  it('deduplicates project GEARS callbacks by submit idempotency key', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const submitRes = await submitProjectGearsJobs(enriched.project_id!, {
      job_type: 'seedance_video',
      source_unit_ids: ['shot-1'],
      note: 'GEARS idempotency callback submit smoke',
    });
    expect(submitRes.ok).toBe(true);
    const job = submitRes.data!.submitted_jobs[0];

    const processingPayload = {
      jobType: 'seedance_video' as const,
      taskStatus: 'PROCESSING',
      progress: 0.5,
      idempotencyKey: 'seedance_video:shot-1',
      message: 'GEARS worker accepted shot-1',
    };
    const processingRes = await importProjectGearsCallback(enriched.project_id!, processingPayload);
    expect(processingRes.ok).toBe(true);
    expect(processingRes.data).toMatchObject({
      received_count: 1,
      updated_count: 1,
      failed_count: 0,
      duplicate_count: 0,
      source_unit_id: 'shot-1',
      status: 'processing',
    });
    expect(processingRes.data?.gears_job_ledger?.items.find(item => item.source_unit_id === 'shot-1')).toMatchObject({
      gears_job_id: job.gears_job_id,
      idempotency_key: 'seedance_video:shot-1',
      callback_events: [expect.objectContaining({
        event_id: 'seedance_video:shot-1',
        event_id_source: 'idempotency_key',
        status: 'processing',
        progress_percent: 50,
      })],
    });

    const callbackPayload = {
      jobType: 'seedance_video' as const,
      taskStatus: 'COMPLETED',
      outputUrl: 'https://gears.example/videos/idempotent-shot-1.mp4',
      idempotencyKey: 'seedance_video:shot-1',
      message: 'GEARS worker completed shot-1',
    };
    const callbackRes = await importProjectGearsCallback(enriched.project_id!, callbackPayload);
    expect(callbackRes.ok).toBe(true);
    expect(callbackRes.data).toMatchObject({
      received_count: 1,
      updated_count: 1,
      failed_count: 0,
      duplicate_count: 0,
      source_unit_id: 'shot-1',
      status: 'ready',
    });
    expect(callbackRes.data?.gears_job_ledger?.items.find(item => item.source_unit_id === 'shot-1')).toMatchObject({
      gears_job_id: job.gears_job_id,
      idempotency_key: 'seedance_video:shot-1',
      callback_events: [expect.objectContaining({
        event_id: 'seedance_video:shot-1',
        event_id_source: 'idempotency_key',
        status: 'processing',
      }), expect.objectContaining({
        event_id: 'seedance_video:shot-1',
        event_id_source: 'idempotency_key',
        status: 'ready',
      })],
    });

    const duplicateRes = await importProjectGearsCallback(enriched.project_id!, callbackPayload);
    expect(duplicateRes.ok).toBe(true);
    expect(duplicateRes.data).toMatchObject({
      received_count: 1,
      updated_count: 1,
      failed_count: 0,
      duplicate_count: 1,
    });
    const duplicateItem = duplicateRes.data?.gears_job_ledger?.items.find(item =>
      item.source_unit_id === 'shot-1'
    );
    expect(duplicateItem?.callback_events?.filter(event =>
      event.event_id === 'seedance_video:shot-1'
    )).toHaveLength(2);
    expect(duplicateRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-1'
    )?.versions.filter(version =>
      version.video_url === 'https://gears.example/videos/idempotent-shot-1.mp4'
    )).toHaveLength(1);
  });

  it('submits project GEARS jobs through the HTTP execution contract', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');
    process.env.GEARS_API_BASE_URL = 'https://gears.example.test/api-root';
    process.env.GEARS_API_TOKEN = 'gears-token';
    process.env.GEARS_CALLBACK_BASE_URL = 'https://story.example.test/public/';

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(String(_url)).toBe('https://gears.example.test/api-root/gears/jobs');
      expect(init?.method).toBe('POST');
      expect((init?.headers as Record<string, string>).authorization).toBe('Bearer gears-token');
      const body = JSON.parse(String(init?.body)) as {
        schema_version?: string;
        source_project_id?: string;
        source_story_id?: string;
        job_type?: string;
        callback_path?: string;
        callback_url?: string;
        callback_secret_hint?: string;
        payload?: {
          units?: Array<{
            source_unit_id?: string;
            external_id?: string;
            externalId?: string;
            custom_id?: string;
            customId?: string;
            idempotency_key?: string;
            callback_url?: string;
            seedance_prompt?: string;
            metadata?: Record<string, unknown>;
          }>;
        };
      };
      expect(body).toMatchObject({
        schema_version: 'gears-execution-submit/v1',
        source_project_id: enriched.project_id,
        source_story_id: story.storyId,
        job_type: 'seedance_video',
        callback_path: `/api/projects/${enriched.project_id}/gears-callback`,
        callback_url: `https://story.example.test/public/api/projects/${enriched.project_id}/gears-callback`,
        callback_secret_hint: 'GEARS_CALLBACK_SECRET',
      });
      expect(body.payload?.units).toHaveLength(1);
      expect(body.payload?.units?.[0]).toMatchObject({
        source_unit_id: 'shot-1',
        external_id: 'shot-1',
        externalId: 'shot-1',
        custom_id: 'shot-1',
        customId: 'shot-1',
        idempotency_key: 'seedance_video:shot-1',
        callback_url: `https://story.example.test/public/api/projects/${enriched.project_id}/gears-callback`,
        seedance_prompt: expect.stringContaining('0-3秒'),
        metadata: expect.objectContaining({
          source_project_id: enriched.project_id,
          source_story_id: story.storyId,
          job_type: 'seedance_video',
          source_unit_id: 'shot-1',
          local_gears_job_id: 'local-gears-seedance_video-shot-1-1',
        }),
      });
      return new Response(JSON.stringify({
        gears_job_id: 'gears-real-job-001',
        status: 'queued',
        accepted_units: [{ source_unit_id: 'shot-1' }],
        rejected_units: [],
      }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const submitRes = await submitProjectGearsJobs(enriched.project_id!, {
      job_type: 'seedance_video',
      source_unit_ids: ['shot-1'],
      use_gears_api: true,
      note: 'GEARS HTTP submit smoke',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(submitRes.ok).toBe(true);
    expect(submitRes.data).toMatchObject({
      submitted_count: 1,
      failed_count: 0,
      provider_adapter: {
        endpoint_configured: true,
        status: 'submitted',
        requested_count: 1,
        accepted_count: 1,
      },
      submitted_jobs: [{
        source_unit_id: 'shot-1',
        gears_job_id: 'gears-real-job-001',
        status: 'submitted',
      }],
    });
    expect(submitRes.data?.seedance_shot_ledger?.items.find(item => item.shot_id === 'shot-1')).toMatchObject({
      provider: 'gears',
      provider_job_id: 'gears-real-job-001',
      status: 'submitted',
    });
  });

  it('writes rejected GEARS submit units into project ledgers', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');
    process.env.GEARS_API_BASE_URL = 'https://gears.example.test/api-root';
    process.env.GEARS_API_TOKEN = 'gears-token';

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      data: {
        acceptedUnits: [{
          taskId: 'gears-submit-accepted-shot-1',
          externalId: 'shot-1',
          taskStatus: 'QUEUED',
          idempotencyKey: 'seedance_video:shot-1',
        }],
        rejectedUnits: [{
          taskId: 'gears-submit-rejected-shot-2',
          externalId: 'shot-2',
          taskStatus: 'VALIDATION_ERROR',
          idempotencyKey: 'seedance_video:shot-2',
          errorCode: 'INVALID_PAYLOAD',
          message: 'seedance_prompt is required',
        }],
      },
    }))));

    const submitRes = await submitProjectGearsJobs(enriched.project_id!, {
      job_type: 'seedance_video',
      source_unit_ids: ['shot-1', 'shot-2'],
      use_gears_api: true,
      note: 'GEARS rejected submit smoke',
    });

    expect(submitRes.ok).toBe(true);
    expect(submitRes.data).toMatchObject({
      submitted_count: 1,
      failed_count: 1,
      provider_adapter: {
        endpoint_configured: true,
        requested_count: 2,
        accepted_count: 1,
        rejected_count: 1,
      },
    });
    const gearsLedger = submitRes.data!.gears_job_ledger!;
    expect(gearsLedger.items.find(item => item.source_unit_id === 'shot-1')).toMatchObject({
      gears_job_id: 'gears-submit-accepted-shot-1',
      status: 'submitted',
    });
    expect(gearsLedger.items.find(item => item.source_unit_id === 'shot-2')).toMatchObject({
      gears_job_id: 'gears-submit-rejected-shot-2',
      idempotency_key: 'seedance_video:shot-2',
      status: 'rejected',
      failure_category: 'payload_invalid',
      error_code: 'INVALID_PAYLOAD',
      failure_reason: 'seedance_prompt is required',
    });
    expect(submitRes.data?.seedance_shot_ledger?.items.find(item => item.shot_id === 'shot-2')).toMatchObject({
      provider: 'gears',
      provider_job_id: 'gears-submit-rejected-shot-2',
      status: 'failed',
      failure_category: 'prompt_invalid',
      provider_error_code: 'INVALID_PAYLOAD',
      failure_reason: 'seedance_prompt is required',
    });
  });

  it('syncs project GEARS job status through the HTTP status contract', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');
    process.env.GEARS_API_BASE_URL = 'https://gears.example.test/api-root';
    process.env.GEARS_API_TOKEN = 'gears-token';

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const submitRes = await submitProjectGearsJobs(enriched.project_id!, {
      job_type: 'seedance_video',
      source_unit_ids: ['shot-1', 'shot-2'],
      note: 'GEARS sync setup',
    });
    expect(submitRes.ok).toBe(true);
    expect(submitRes.data!.submitted_jobs).toHaveLength(2);
    const readyJob = submitRes.data!.submitted_jobs.find(item => item.source_unit_id === 'shot-1')!;
    const failedJob = submitRes.data!.submitted_jobs.find(item => item.source_unit_id === 'shot-2')!;

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const url = String(_url);
      expect(init?.method).toBe('GET');
      expect((init?.headers as Record<string, string>).authorization).toBe('Bearer gears-token');
      if (url === `https://gears.example.test/api-root/gears/jobs/${encodeURIComponent(failedJob.gears_job_id)}`) {
        return new Response('temporary GEARS outage', { status: 503 });
      }
      expect(url).toBe(`https://gears.example.test/api-root/gears/jobs/${encodeURIComponent(readyJob.gears_job_id)}`);
      return new Response(JSON.stringify({
        data: {
          job: {
            task_id: readyJob.gears_job_id,
            external_id: 'shot-1',
            job_type: 'seedance_video',
            job_status: 'succeeded',
            progress: 0.82,
            output: {
              files: [{
                mediaUrl: 'https://gears.example.test/media/shot-1.mp4',
                mediaType: 'video',
                mimeType: 'video/mp4',
              }],
            },
            message: 'GEARS status sync ready',
          },
        },
      }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const syncRes = await syncProjectGearsJobStatuses(enriched.project_id!, {
      job_type: 'seedance_video',
      note: 'GEARS sync smoke',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(syncRes.ok).toBe(true);
    expect(syncRes.data).toMatchObject({
      pollable_count: 2,
      synced_count: 1,
      failed_count: 1,
      duplicate_count: 0,
      provider_adapter: {
        endpoint_configured: true,
        requested_count: 2,
        returned_count: 1,
        failed_count: 1,
      },
      synced_jobs: [{
        source_unit_id: 'shot-1',
        gears_job_id: readyJob.gears_job_id,
        status: 'ready',
        progress_percent: 82,
        artifact_urls: ['https://gears.example.test/media/shot-1.mp4'],
      }],
    });
    expect(syncRes.data?.seedance_shot_ledger?.items.find(item => item.shot_id === 'shot-1')).toMatchObject({
      provider: 'gears',
      provider_job_id: readyJob.gears_job_id,
      status: 'ready',
      video_url: 'https://gears.example.test/media/shot-1.mp4',
    });
    expect(syncRes.data?.seedance_shot_ledger?.items.find(item => item.shot_id === 'shot-2')).toMatchObject({
      provider: 'gears',
      provider_job_id: failedJob.gears_job_id,
      status: 'submitted',
    });
    expect(syncRes.data?.gears_job_ledger?.items.find(item =>
      item.gears_job_id === failedJob.gears_job_id
    )).toMatchObject({
      status: 'submitted',
      last_poll_at: expect.any(String),
      last_poll_error: expect.stringContaining('HTTP 503'),
      last_poll_failure_category: 'provider_server_error',
      last_poll_error_code: 'HTTP_503',
    });
    expect(syncRes.data?.failures[0]).toMatchObject({
      source_unit_id: 'shot-2',
      gears_job_id: failedJob.gears_job_id,
    });
    expect(syncRes.data?.failures[0]?.message).toContain('HTTP 503');

    const duplicateSyncRes = await syncProjectGearsJobStatuses(enriched.project_id!, {
      job_type: 'seedance_video',
      include_completed: true,
      note: 'GEARS sync smoke',
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(duplicateSyncRes.ok).toBe(true);
    expect(duplicateSyncRes.data).toMatchObject({
      pollable_count: 2,
      synced_count: 1,
      failed_count: 1,
      duplicate_count: 1,
      failures: [{
        source_unit_id: 'shot-2',
        gears_job_id: failedJob.gears_job_id,
      }],
    });
  });

  it('normalizes failed project GEARS status responses into the shot ledger', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');
    process.env.GEARS_API_BASE_URL = 'https://gears.example.test/api-root';
    process.env.GEARS_API_TOKEN = 'gears-token';

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const submitRes = await submitProjectGearsJobs(enriched.project_id!, {
      job_type: 'seedance_video',
      source_unit_ids: ['shot-1'],
      note: 'GEARS failed sync setup',
    });
    expect(submitRes.ok).toBe(true);
    const job = submitRes.data!.submitted_jobs[0]!;

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(String(_url)).toBe(`https://gears.example.test/api-root/gears/jobs/${encodeURIComponent(job.gears_job_id)}`);
      expect(init?.method).toBe('GET');
      expect((init?.headers as Record<string, string>).authorization).toBe('Bearer gears-token');
      return new Response(JSON.stringify({
        taskId: job.gears_job_id,
        sourceUnitId: 'shot-1',
        jobType: 'seedance_video',
        taskStatus: 'FAILED',
        errorCode: 'NO_CREDIT',
        failureReason: 'GEARS provider balance is insufficient',
        message: 'GEARS failed with provider quota issue',
      }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const syncRes = await syncProjectGearsJobStatuses(enriched.project_id!, {
      job_type: 'seedance_video',
      note: 'GEARS failed status sync smoke',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(syncRes.ok).toBe(true);
    expect(syncRes.data).toMatchObject({
      pollable_count: 1,
      synced_count: 1,
      failed_count: 0,
      synced_jobs: [{
        source_unit_id: 'shot-1',
        gears_job_id: job.gears_job_id,
        status: 'failed',
        failure_category: 'provider_quota',
        error_code: 'NO_CREDIT',
        failure_reason: 'GEARS provider balance is insufficient',
      }],
    });
    expect(syncRes.data?.seedance_shot_ledger?.items.find(item => item.shot_id === 'shot-1')).toMatchObject({
      provider: 'gears',
      provider_job_id: job.gears_job_id,
      status: 'failed',
      failure_reason: 'GEARS provider balance is insufficient',
      failure_category: 'provider_quota',
      provider_error_code: 'NO_CREDIT',
    });
  });

  it('derives project GEARS failure category from platform status aliases', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');
    process.env.GEARS_API_BASE_URL = 'https://gears.example.test/api-root';
    process.env.GEARS_API_TOKEN = 'gears-token';

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const submitRes = await submitProjectGearsJobs(enriched.project_id!, {
      job_type: 'seedance_video',
      source_unit_ids: ['shot-1'],
      note: 'GEARS status alias sync setup',
    });
    expect(submitRes.ok).toBe(true);
    const job = submitRes.data!.submitted_jobs[0]!;

    const fetchMock = vi.fn(async (_url: string | URL | Request) => {
      expect(String(_url)).toBe(`https://gears.example.test/api-root/gears/jobs/${encodeURIComponent(job.gears_job_id)}`);
      return new Response(JSON.stringify({
        taskId: job.gears_job_id,
        sourceUnitId: 'shot-1',
        jobType: 'seedance_video',
        taskStatus: 'TIMED_OUT',
      }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const syncRes = await syncProjectGearsJobStatuses(enriched.project_id!, {
      job_type: 'seedance_video',
      note: 'GEARS status alias sync smoke',
    });

    expect(syncRes.ok).toBe(true);
    expect(syncRes.data?.synced_jobs[0]).toMatchObject({
      source_unit_id: 'shot-1',
      gears_job_id: job.gears_job_id,
      status: 'failed',
      failure_category: 'provider_timeout',
      failure_reason: 'TIMED_OUT',
    });
    expect(syncRes.data?.seedance_shot_ledger?.items.find(item => item.shot_id === 'shot-1')).toMatchObject({
      provider: 'gears',
      provider_job_id: job.gears_job_id,
      status: 'failed',
      failure_reason: 'TIMED_OUT',
      failure_category: 'provider_timeout',
    });
  });

  it('submits Seedance shots through a configured provider adapter', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');
    process.env.SEEDANCE_PROVIDER_SUBMIT_ENDPOINT = 'https://adapter.example.test/seedance/submit';
    process.env.SEEDANCE_PROVIDER_SUBMIT_API_TOKEN = 'submit-token';
    process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_HEADER = 'X-Api-Key';
    process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_SCHEME = 'raw';
    process.env.SEEDANCE_PROVIDER_CALLBACK_BASE_URL = 'https://story.example.test/root/';

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const submitFetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(String(_url)).toBe('https://adapter.example.test/seedance/submit');
      expect(init?.method).toBe('POST');
      expect((init?.headers as Record<string, string>)['X-Api-Key']).toBe('submit-token');
      expect((init?.headers as Record<string, string>).authorization).toBeUndefined();
      const body = JSON.parse(String(init?.body)) as {
        project_id: string;
        provider?: string;
        queue_id?: string;
        queue_priority?: string;
        provider_callback_path?: string;
        provider_poll_path?: string;
        provider_callback_url?: string;
        provider_poll_url?: string;
        shots: Array<{ shot_id: string; provider_job_id?: string; seedance_prompt?: string; seedance_asset_slots?: unknown[] }>;
      };
      expect(body.project_id).toBe(enriched.project_id);
      expect(body.provider).toBe('seedance');
      expect(body.queue_id).toBe('adapter-submit-queue-local');
      expect(body.queue_priority).toBe('high');
      expect(body.provider_callback_path).toBe(
        `/api/projects/${enriched.project_id}/production-board/seedance-shots/provider-callback`,
      );
      expect(body.provider_poll_path).toBe(
        `/api/projects/${enriched.project_id}/production-board/seedance-shots/poll-provider`,
      );
      expect(body.provider_callback_url).toBe(
        `https://story.example.test/root/api/projects/${enriched.project_id}/production-board/seedance-shots/provider-callback`,
      );
      expect(body.provider_poll_url).toBe(
        `https://story.example.test/root/api/projects/${enriched.project_id}/production-board/seedance-shots/poll-provider`,
      );
      expect(body.shots).toHaveLength(2);
      expect(body.shots[0]).toMatchObject({
        shot_id: 'shot-1',
        provider_job_id: 'adapter-submit-local-shot-1',
      });
      expect(body.shots[0].seedance_prompt).toContain('0-3秒');
      expect(body.shots[0].seedance_asset_slots).toBeInstanceOf(Array);
      return new Response(JSON.stringify({
        data: {
          tasks: [{
            shot_id: 'shot-1',
            taskId: 'real-seedance-job-shot-1',
            batchId: 'real-seedance-queue-001',
            position: 11,
            taskStatus: 'running',
          }, {
            shot_id: 'shot-2',
            task_id: 'real-seedance-job-shot-2',
            batch_id: 'real-seedance-queue-001',
            position: 12,
            task_status: 'queued',
          }],
        },
      }));
    });
    vi.stubGlobal('fetch', submitFetchMock);

    const adapterSubmitRes = await submitProjectSeedanceShotsToProvider(enriched.project_id!, {
      shot_ids: ['shot-1', 'shot-2'],
      provider: 'seedance',
      job_prefix: 'adapter-submit-local',
      queue_id: 'adapter-submit-queue-local',
      queue_priority: 'high',
      use_provider_adapter: true,
      note: '真实 adapter 提交',
    });
    expect(submitFetchMock).toHaveBeenCalledTimes(1);
    expect(adapterSubmitRes.ok).toBe(true);
    expect(adapterSubmitRes.data).toMatchObject({
      submitted_count: 2,
      skipped_count: 0,
      failed_count: 0,
      provider_adapter: {
        endpoint_configured: true,
        requested_count: 2,
        accepted_count: 2,
        failed_count: 0,
      },
    });
    expect(adapterSubmitRes.data?.provider_queue_batch).toMatchObject({
      queue_id: 'real-seedance-queue-001',
      provider: 'seedance',
      priority: 'high',
      items: [{
        shot_id: 'shot-1',
        provider_job_id: 'real-seedance-job-shot-1',
        queue_position: 11,
        status: 'processing',
      }, {
        shot_id: 'shot-2',
        provider_job_id: 'real-seedance-job-shot-2',
        queue_position: 12,
        status: 'submitted',
      }],
    });
    expect(adapterSubmitRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-1'
    )).toMatchObject({
      status: 'processing',
      provider_job_id: 'real-seedance-job-shot-1',
      provider_queue_id: 'real-seedance-queue-001',
      provider_queue_position: 11,
    });
  });

  it('submits Seedance shots through a per-shot provider adapter', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');
    process.env.SEEDANCE_PROVIDER_SUBMIT_ENDPOINT = 'https://adapter.example.test/seedance/submit-one';
    process.env.SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE = 'per_shot';

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const submitFetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(String(_url)).toBe('https://adapter.example.test/seedance/submit-one');
      const body = JSON.parse(String(init?.body)) as {
        request_mode?: string;
        shot?: { shot_id: string; provider_job_id?: string };
        shots?: Array<{ shot_id: string; provider_job_id?: string }>;
      };
      expect(body.request_mode).toBe('per_shot');
      expect(body.shot).toBeDefined();
      expect(body.shots).toHaveLength(1);
      if (body.shot?.shot_id === 'shot-1') {
        return new Response(JSON.stringify({
          taskId: 'real-per-shot-job-1',
          batchId: 'real-per-shot-queue',
          taskStatus: 'running',
        }));
      }
      return new Response(JSON.stringify({
        data: {
          task_id: 'real-per-shot-job-2',
          batch_id: 'real-per-shot-queue',
          task_status: 'queued',
        },
      }));
    });
    vi.stubGlobal('fetch', submitFetchMock);

    const adapterSubmitRes = await submitProjectSeedanceShotsToProvider(enriched.project_id!, {
      shot_ids: ['shot-1', 'shot-2'],
      provider: 'seedance',
      job_prefix: 'adapter-submit-local',
      queue_id: 'adapter-submit-queue-local',
      use_provider_adapter: true,
      note: '逐镜头 adapter 提交',
    });

    expect(submitFetchMock).toHaveBeenCalledTimes(2);
    expect(adapterSubmitRes.ok).toBe(true);
    expect(adapterSubmitRes.data).toMatchObject({
      submitted_count: 2,
      failed_count: 0,
      provider_adapter: {
        request_mode: 'per_shot',
        requested_count: 2,
        accepted_count: 2,
        failed_count: 0,
      },
      submitted_shots: [{
        shot_id: 'shot-1',
        provider_job_id: 'real-per-shot-job-1',
      }, {
        shot_id: 'shot-2',
        provider_job_id: 'real-per-shot-job-2',
      }],
    });
  });

  it('submits Seedance shots through a platform payload adapter with HMAC signature', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');
    process.env.SEEDANCE_PROVIDER_SUBMIT_ENDPOINT = 'https://platform.example.test/seedance/tasks';
    process.env.SEEDANCE_PROVIDER_SUBMIT_PAYLOAD_MODE = 'platform';
    process.env.SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_SECRET = 'submit-signing-secret';
    process.env.SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_HEADER = 'X-Platform-Signature';
    process.env.SEEDANCE_PROVIDER_SUBMIT_TIMESTAMP_HEADER = 'X-Platform-Timestamp';
    process.env.SEEDANCE_PROVIDER_SUBMIT_MODEL = 'seedance-platform-v1';
    process.env.SEEDANCE_PROVIDER_CALLBACK_BASE_URL = 'https://story.example.test/root/';

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const submitFetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const endpoint = 'https://platform.example.test/seedance/tasks';
      expect(String(_url)).toBe(endpoint);
      expect(init?.method).toBe('POST');
      expectProviderSignature({
        init,
        method: 'POST',
        endpoint,
        secret: 'submit-signing-secret',
        signatureHeader: 'X-Platform-Signature',
        timestampHeader: 'X-Platform-Timestamp',
      });
      const body = JSON.parse(String(init?.body)) as {
        schema_version?: string;
        tasks?: Array<{
          prompt?: string;
          duration?: number;
          external_id?: string;
          callback_url?: string;
          poll_url?: string;
          model?: string;
          assets?: unknown[];
          negative_prompt?: string;
          metadata?: Record<string, unknown>;
        }>;
        metadata?: Record<string, unknown>;
      };
      expect(body.schema_version).toBeUndefined();
      expect(body.tasks).toHaveLength(2);
      expect(body.tasks?.[0]).toMatchObject({
        prompt: expect.stringContaining('0-3秒'),
        external_id: 'shot-1',
        callback_url: `https://story.example.test/root/api/projects/${enriched.project_id}/production-board/seedance-shots/provider-callback`,
        poll_url: `https://story.example.test/root/api/projects/${enriched.project_id}/production-board/seedance-shots/poll-provider`,
        model: 'seedance-platform-v1',
        metadata: {
          project_id: enriched.project_id,
          story_id: story.storyId,
          shot_id: 'shot-1',
          local_provider_job_id: 'platform-submit-local-shot-1',
          provider_queue_position: 1,
        },
      });
      expect(body.tasks?.[0].assets).toBeInstanceOf(Array);
      expect(body.tasks?.[0].negative_prompt).toContain('不要');
      expect(body.metadata).toMatchObject({
        schema_version: 'seedance-provider-platform-submit/v1',
        project_id: enriched.project_id,
      });
      return new Response(JSON.stringify({
        data: {
          tasks: [{
            external_id: 'shot-1',
            task_id: 'platform-real-job-shot-1',
            batch_id: 'platform-real-queue',
            position: 3,
            status: 'queued',
          }, {
            external_id: 'shot-2',
            task_id: 'platform-real-job-shot-2',
            batch_id: 'platform-real-queue',
            position: 4,
            status: 'running',
          }],
        },
      }));
    });
    vi.stubGlobal('fetch', submitFetchMock);

    const adapterSubmitRes = await submitProjectSeedanceShotsToProvider(enriched.project_id!, {
      shot_ids: ['shot-1', 'shot-2'],
      provider: 'seedance',
      job_prefix: 'platform-submit-local',
      queue_id: 'platform-submit-local-queue',
      use_provider_adapter: true,
      note: 'platform payload submit',
    });

    expect(submitFetchMock).toHaveBeenCalledTimes(1);
    expect(adapterSubmitRes.ok).toBe(true);
    expect(adapterSubmitRes.data).toMatchObject({
      submitted_count: 2,
      failed_count: 0,
      provider_queue_batch: {
        queue_id: 'platform-real-queue',
        items: [{
          shot_id: 'shot-1',
          provider_job_id: 'platform-real-job-shot-1',
          queue_position: 3,
          status: 'submitted',
        }, {
          shot_id: 'shot-2',
          provider_job_id: 'platform-real-job-shot-2',
          queue_position: 4,
          status: 'processing',
        }],
      },
    });
  });

  it('imports an external Seedance provider callback by queue metadata', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const submitRes = await submitProjectSeedanceShotsToProvider(enriched.project_id!, {
      shot_ids: ['shot-1'],
      provider: 'seedance',
      job_prefix: 'provider-callback-test',
      queue_id: 'provider-callback-queue-001',
      queue_priority: 'high',
      note: 'provider callback 测试提交',
    });
    expect(submitRes.ok).toBe(true);
    expect(submitRes.data?.submitted_count).toBe(1);

    const callbackRes = await importProjectSeedanceProviderCallback(enriched.project_id!, {
      provider: 'seedance',
      queueId: 'provider-callback-queue-001',
      queuePosition: 1,
      status: 'completed',
      videoUrl: 'https://example.com/seedance-videos/provider-callback-shot-1.mp4',
      qualityScore: 94,
      reviewNote: 'provider webhook 回片可用',
      event_id: 'provider-event-001',
      message: 'provider completed',
    });
    expect(callbackRes.ok).toBe(true);
    expect(callbackRes.data).toMatchObject({
      updated_count: 1,
      failed_count: 0,
      provider: 'seedance',
      provider_queue_id: 'provider-callback-queue-001',
      provider_queue_position: 1,
      event_id: 'provider-event-001',
    });
    expect(callbackRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-1'
    )).toMatchObject({
      status: 'ready',
      provider: 'seedance',
      provider_job_id: 'provider-callback-test-shot-1',
      provider_queue_id: 'provider-callback-queue-001',
      provider_queue_position: 1,
      video_url: 'https://example.com/seedance-videos/provider-callback-shot-1.mp4',
      selected_version_id: 'seedance-shot-shot-1-v2',
    });
  });

  it('polls Seedance provider targets and applies returned status snapshots', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const submitRes = await submitProjectSeedanceShotsToProvider(enriched.project_id!, {
      shot_ids: ['shot-1', 'shot-2'],
      provider: 'seedance',
      job_prefix: 'provider-poll-test',
      queue_id: 'provider-poll-queue-001',
      note: 'provider poll 测试提交',
    });
    expect(submitRes.ok).toBe(true);

    const dryRunRes = await pollProjectSeedanceProviderQueue(enriched.project_id!, {
      provider: 'seedance',
      queue_id: 'provider-poll-queue-001',
      include_prompt: true,
    });
    expect(dryRunRes.ok).toBe(true);
    expect(dryRunRes.data).toMatchObject({
      dry_run: true,
      provider: 'seedance',
      queue_id: 'provider-poll-queue-001',
      checked_count: 2,
      pollable_count: 2,
      updated_count: 0,
    });
    expect(dryRunRes.data?.poll_targets[0]).toMatchObject({
      shot_id: 'shot-1',
      provider_job_id: 'provider-poll-test-shot-1',
      provider_queue_id: 'provider-poll-queue-001',
      provider_queue_position: 1,
      status: 'submitted',
    });
    expect(dryRunRes.data?.poll_targets[0].seedance_prompt).toContain('0-3秒');

    const pollApplyRes = await pollProjectSeedanceProviderQueue(enriched.project_id!, {
      provider: 'seedance',
      queue_id: 'provider-poll-queue-001',
      provider_results: [{
        jobId: 'provider-poll-test-shot-1',
        status: 'success',
        url: 'https://example.com/seedance-videos/provider-poll-shot-1.mp4',
        qualityScore: 95,
        reviewNote: 'poll 回片可用',
        message: 'provider poll completed',
      }, {
        jobId: 'provider-poll-test-shot-2',
        status: 'failed',
        errorCode: 'RATE_LIMIT_429',
        error: '平台限流，请稍后重试',
        message: 'provider rate limited',
      }],
      note: 'provider poll 应用回传',
    });
    expect(pollApplyRes.ok).toBe(true);
    expect(pollApplyRes.data).toMatchObject({
      dry_run: false,
      provider: 'seedance',
      queue_id: 'provider-poll-queue-001',
      checked_count: 2,
      pollable_count: 0,
      updated_count: 2,
      failed_count: 0,
      poll_targets: [],
    });
    expect(pollApplyRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-1'
    )).toMatchObject({
      status: 'ready',
      provider: 'seedance',
      provider_job_id: 'provider-poll-test-shot-1',
      provider_queue_id: 'provider-poll-queue-001',
      video_url: 'https://example.com/seedance-videos/provider-poll-shot-1.mp4',
      selected_version_id: 'seedance-shot-shot-1-v2',
    });
    expect(pollApplyRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-2'
    )).toMatchObject({
      status: 'failed',
      provider: 'seedance',
      provider_job_id: 'provider-poll-test-shot-2',
      provider_queue_id: 'provider-poll-queue-001',
      failure_reason: '平台限流，请稍后重试',
      failure_category: 'provider_rate_limit',
      provider_error_code: 'RATE_LIMIT_429',
    });

    const retryPackageRes = await exportProjectSeedanceRetryPackage(enriched.project_id!);
    expect(retryPackageRes.ok).toBe(true);
    expect(retryPackageRes.data?.shots.find(shot => shot.shot_id === 'shot-2')).toMatchObject({
      failure_reason: '平台限流，请稍后重试',
      failure_category: 'provider_rate_limit',
      provider_error_code: 'RATE_LIMIT_429',
      suggested_action: '等待限流窗口恢复后再重新提交。',
    });
    expect(retryPackageRes.data?.markdown).toContain('失败分类: provider_rate_limit');
    expect(retryPackageRes.data?.markdown).toContain('Provider 错误码: RATE_LIMIT_429');
  });

  it('maps provider error code aliases into failure categories', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const submitRes = await submitProjectSeedanceShotsToProvider(enriched.project_id!, {
      shot_ids: ['shot-1', 'shot-2'],
      provider: 'seedance',
      job_prefix: 'provider-code-map-test',
      queue_id: 'provider-code-map-queue-001',
      note: 'provider 错误码映射测试提交',
    });
    expect(submitRes.ok).toBe(true);

    const callbackRes = await importProjectSeedanceShotCallbacks(enriched.project_id!, {
      callbacks: [{
        jobId: 'provider-code-map-test-shot-1',
        status: 'failed',
        errorCode: 'INSUFFICIENT_BALANCE',
        error: 'provider failed',
      }, {
        jobId: 'provider-code-map-test-shot-2',
        status: 'failed',
        errorCode: 'TOKEN_EXPIRED',
        error: 'provider failed',
      }],
    });
    expect(callbackRes.ok).toBe(true);
    expect(callbackRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-1'
    )).toMatchObject({
      status: 'failed',
      failure_category: 'provider_quota',
      provider_error_code: 'INSUFFICIENT_BALANCE',
    });
    expect(callbackRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-2'
    )).toMatchObject({
      status: 'failed',
      failure_category: 'provider_auth',
      provider_error_code: 'TOKEN_EXPIRED',
    });

    const retryPackageRes = await exportProjectSeedanceRetryPackage(enriched.project_id!);
    expect(retryPackageRes.ok).toBe(true);
    expect(retryPackageRes.data?.shots.find(shot => shot.shot_id === 'shot-1')).toMatchObject({
      failure_category: 'provider_quota',
      suggested_action: '先确认 provider 额度或余额，再重新提交。',
    });
    expect(retryPackageRes.data?.shots.find(shot => shot.shot_id === 'shot-2')).toMatchObject({
      failure_category: 'provider_auth',
      suggested_action: '先检查 provider 凭证和权限配置，再重新提交。',
    });
  });

  it('builds a Seedance provider queue overview with timeout and failure summaries', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const submitRes = await submitProjectSeedanceShotsToProvider(enriched.project_id!, {
      shot_ids: ['shot-1', 'shot-2'],
      provider: 'seedance',
      job_prefix: 'provider-overview-test',
      queue_id: 'provider-overview-queue-001',
      queue_priority: 'high',
      note: 'provider overview 测试提交',
    });
    expect(submitRes.ok).toBe(true);

    const callbackRes = await importProjectSeedanceShotCallbacks(enriched.project_id!, {
      callbacks: [{
        jobId: 'provider-overview-test-shot-2',
        status: 'failed',
        errorCode: 'RATE_LIMIT_429',
        error: '平台限流，请稍后重试',
      }],
    });
    expect(callbackRes.ok).toBe(true);

    const projectFile = resolve(root, 'web', 'generated', 'projects', enriched.project_id!, 'project.json');
    const staleProject = JSON.parse(await readFile(projectFile, 'utf8')) as StoryProjectMeta;
    staleProject.seedance_shot_ledger = {
      ...staleProject.seedance_shot_ledger!,
      items: staleProject.seedance_shot_ledger!.items.map(item =>
        item.shot_id === 'shot-1'
          ? {
              ...item,
              submitted_at: '2026-06-09T10:00:00.000Z',
              updated_at: '2026-06-09T10:00:00.000Z',
            }
          : item
      ),
    };
    await writeFile(projectFile, JSON.stringify(staleProject, null, 2));

    const overviewRes = await getProjectSeedanceProviderQueueOverview(enriched.project_id!, {
      provider: 'seedance',
      queue_id: 'provider-overview-queue-001',
      timeout_minutes: 60,
    });
    expect(overviewRes.ok).toBe(true);
    expect(overviewRes.data).toMatchObject({
      provider: 'seedance',
      queue_id: 'provider-overview-queue-001',
      timeout_minutes: 60,
      total_shot_count: 2,
      active_count: 1,
      failed_count: 1,
      retryable_count: 2,
      timed_out_count: 1,
      attention_count: 2,
      batch_count: 1,
      status_counts: {
        submitted: 1,
        failed: 1,
      },
      latest_queue_batch: {
        queue_id: 'provider-overview-queue-001',
        provider: 'seedance',
        priority: 'high',
        active_count: 1,
        failed_item_count: 1,
        timed_out_count: 1,
      },
    });
    expect(overviewRes.data?.attention_items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        shot_id: 'shot-1',
        status: 'submitted',
        timed_out: true,
        suggested_action: '确认平台任务是否超时；如无结果则重新提交。',
      }),
      expect.objectContaining({
        shot_id: 'shot-2',
        status: 'failed',
        failure_category: 'provider_rate_limit',
        provider_error_code: 'RATE_LIMIT_429',
        suggested_action: '等待限流窗口恢复后再重新提交。',
      }),
    ]));
  });

  it('builds a Seedance provider retry plan with resubmit and blocked candidates', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const submitRes = await submitProjectSeedanceShotsToProvider(enriched.project_id!, {
      shot_ids: ['shot-1', 'shot-2'],
      provider: 'seedance',
      job_prefix: 'provider-retry-plan-test',
      queue_id: 'provider-retry-plan-queue-001',
      note: 'provider retry plan 测试提交',
    });
    expect(submitRes.ok).toBe(true);

    const callbackRes = await importProjectSeedanceShotCallbacks(enriched.project_id!, {
      callbacks: [{
        jobId: 'provider-retry-plan-test-shot-2',
        status: 'failed',
        errorCode: 'ASSET_MISSING',
        error: '缺少参考素材文件',
      }],
    });
    expect(callbackRes.ok).toBe(true);

    const projectFile = resolve(root, 'web', 'generated', 'projects', enriched.project_id!, 'project.json');
    const staleProject = JSON.parse(await readFile(projectFile, 'utf8')) as StoryProjectMeta;
    staleProject.seedance_shot_ledger = {
      ...staleProject.seedance_shot_ledger!,
      items: staleProject.seedance_shot_ledger!.items.map(item =>
        item.shot_id === 'shot-1'
          ? {
              ...item,
              submitted_at: '2026-06-09T10:00:00.000Z',
              updated_at: '2026-06-09T10:00:00.000Z',
            }
          : item
      ),
    };
    await writeFile(projectFile, JSON.stringify(staleProject, null, 2));

    const retryPlanRes = await getProjectSeedanceProviderRetryPlan(enriched.project_id!, {
      provider: 'seedance',
      queue_id: 'provider-retry-plan-queue-001',
      timeout_minutes: 60,
      max_retry_count: 3,
    });
    expect(retryPlanRes.ok).toBe(true);
    expect(retryPlanRes.data).toMatchObject({
      provider: 'seedance',
      queue_id: 'provider-retry-plan-queue-001',
      timeout_minutes: 60,
      max_retry_count: 3,
      candidate_count: 2,
      resubmittable_count: 1,
      blocked_count: 1,
      high_priority_count: 1,
      reason_counts: {
        failed: 1,
        timed_out: 1,
        ready_missing_video: 0,
        unsubmitted: 0,
      },
    });
    expect(retryPlanRes.data?.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        shot_id: 'shot-1',
        retry_reason: 'timed_out',
        priority: 'high',
        can_resubmit: true,
      }),
      expect.objectContaining({
        shot_id: 'shot-2',
        retry_reason: 'failed',
        priority: 'normal',
        failure_category: 'asset_missing',
        provider_error_code: 'ASSET_MISSING',
        can_resubmit: false,
        block_reason: '素材缺失，补齐或重新绑定素材后再提交。',
      }),
    ]));
    expect(retryPlanRes.data?.markdown).toContain('Seedance provider 人工重试策略');
    expect(retryPlanRes.data?.markdown).toContain('可直接重提: 1');

    const retrySubmitRes = await submitProjectSeedanceProviderRetryPlan(enriched.project_id!, {
      provider: 'seedance',
      queue_id: 'provider-retry-plan-queue-001',
      target_queue_id: 'provider-retry-plan-resubmit-001',
      job_prefix: 'provider-retry-resubmit',
      timeout_minutes: 60,
      max_retry_count: 3,
      note: 'provider retry plan 自动重提交',
    });
    expect(retrySubmitRes.ok).toBe(true);
    expect(retrySubmitRes.data).toMatchObject({
      selected_shot_ids: ['shot-1'],
      skipped_blocked_count: 1,
      submitted_count: 1,
      skipped_count: 0,
      failed_count: 0,
      provider_queue_batch: {
        queue_id: 'provider-retry-plan-resubmit-001',
        submitted_count: 1,
        items: [{
          shot_id: 'shot-1',
          provider_job_id: 'provider-retry-resubmit-shot-1',
        }],
      },
    });
    expect(retrySubmitRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-1'
    )).toMatchObject({
      status: 'submitted',
      provider_job_id: 'provider-retry-resubmit-shot-1',
      provider_queue_id: 'provider-retry-plan-resubmit-001',
      retry_count: 1,
    });
    expect(retrySubmitRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-2'
    )).toMatchObject({
      status: 'failed',
      provider_job_id: 'provider-retry-plan-test-shot-2',
      failure_category: 'asset_missing',
    });
  });

  it('queries a configured Seedance provider adapter and applies returned statuses', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');
    process.env.SEEDANCE_PROVIDER_POLL_ENDPOINT = 'https://adapter.example.test/seedance/poll';
    process.env.SEEDANCE_PROVIDER_API_TOKEN = 'adapter-token';
    process.env.SEEDANCE_PROVIDER_POLL_AUTH_HEADER = 'X-Provider-Token';
    process.env.SEEDANCE_PROVIDER_POLL_AUTH_SCHEME = 'Token';

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const submitRes = await submitProjectSeedanceShotsToProvider(enriched.project_id!, {
      shot_ids: ['shot-1', 'shot-2'],
      provider: 'seedance',
      job_prefix: 'provider-adapter-test',
      queue_id: 'provider-adapter-queue-001',
      note: 'provider adapter 测试提交',
    });
    expect(submitRes.ok).toBe(true);

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(String(_url)).toBe('https://adapter.example.test/seedance/poll');
      expect(init?.method).toBe('POST');
      expect((init?.headers as Record<string, string>)['X-Provider-Token']).toBe('Token adapter-token');
      expect((init?.headers as Record<string, string>).authorization).toBeUndefined();
      const body = JSON.parse(String(init?.body)) as {
        project_id: string;
        provider?: string;
        queue_id?: string;
        targets: Array<{ shot_id: string; provider_job_id?: string; seedance_prompt?: string }>;
      };
      expect(body.project_id).toBe(enriched.project_id);
      expect(body.provider).toBe('seedance');
      expect(body.queue_id).toBe('provider-adapter-queue-001');
      expect(body.targets).toHaveLength(2);
      expect(body.targets[0]).toMatchObject({
        shot_id: 'shot-1',
        provider_job_id: 'provider-adapter-test-shot-1',
      });
      expect(body.targets[0].seedance_prompt).toContain('0-3秒');
      return new Response(JSON.stringify({
        data: {
          tasks: [{
            taskId: 'provider-adapter-test-shot-1',
            state: 'SUCCEEDED',
            outputUrl: 'https://example.com/seedance-videos/provider-adapter-shot-1.mp4',
            score: 94,
            review_note: 'adapter 回片可用',
          }, {
            task_id: 'provider-adapter-test-shot-2',
            task_status: 'FAILED',
            code: 'RISK_CONTROL',
            error_message: '内容审核未通过',
          }],
        },
      }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const pollApplyRes = await pollProjectSeedanceProviderQueue(enriched.project_id!, {
      provider: 'seedance',
      queue_id: 'provider-adapter-queue-001',
      include_prompt: true,
      use_provider_adapter: true,
      note: 'provider adapter 应用回传',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(pollApplyRes.ok).toBe(true);
    expect(pollApplyRes.data).toMatchObject({
      dry_run: false,
      provider: 'seedance',
      queue_id: 'provider-adapter-queue-001',
      checked_count: 2,
      pollable_count: 0,
      updated_count: 2,
      failed_count: 0,
      provider_adapter: {
        endpoint_configured: true,
        queried_count: 2,
        returned_count: 2,
      },
    });
    expect(pollApplyRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-1'
    )).toMatchObject({
      status: 'ready',
      provider_job_id: 'provider-adapter-test-shot-1',
      video_url: 'https://example.com/seedance-videos/provider-adapter-shot-1.mp4',
      selected_version_id: 'seedance-shot-shot-1-v2',
    });
    expect(pollApplyRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-2'
    )).toMatchObject({
      status: 'failed',
      provider_job_id: 'provider-adapter-test-shot-2',
      failure_reason: '内容审核未通过',
      failure_category: 'content_policy',
      provider_error_code: 'RISK_CONTROL',
    });
  });

  it('queries a platform payload provider adapter with HMAC signature', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');
    process.env.SEEDANCE_PROVIDER_POLL_ENDPOINT = 'https://platform.example.test/seedance/tasks/query';
    process.env.SEEDANCE_PROVIDER_POLL_PAYLOAD_MODE = 'platform';
    process.env.SEEDANCE_PROVIDER_POLL_SIGNATURE_SECRET = 'poll-signing-secret';
    process.env.SEEDANCE_PROVIDER_POLL_SIGNATURE_HEADER = 'X-Poll-Signature';
    process.env.SEEDANCE_PROVIDER_POLL_TIMESTAMP_HEADER = 'X-Poll-Timestamp';

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const submitRes = await submitProjectSeedanceShotsToProvider(enriched.project_id!, {
      shot_ids: ['shot-1', 'shot-2'],
      provider: 'seedance',
      job_prefix: 'platform-poll-test',
      queue_id: 'platform-poll-queue-001',
      note: 'platform poll 测试提交',
    });
    expect(submitRes.ok).toBe(true);

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const endpoint = 'https://platform.example.test/seedance/tasks/query';
      expect(String(_url)).toBe(endpoint);
      expect(init?.method).toBe('POST');
      expectProviderSignature({
        init,
        method: 'POST',
        endpoint,
        secret: 'poll-signing-secret',
        signatureHeader: 'X-Poll-Signature',
        timestampHeader: 'X-Poll-Timestamp',
      });
      const body = JSON.parse(String(init?.body)) as {
        schema_version?: string;
        task_ids?: string[];
        targets?: Array<{
          task_id?: string;
          external_id?: string;
          metadata?: Record<string, unknown>;
        }>;
        metadata?: Record<string, unknown>;
      };
      expect(body.schema_version).toBeUndefined();
      expect(body.task_ids).toEqual([
        'platform-poll-test-shot-1',
        'platform-poll-test-shot-2',
      ]);
      expect(body.targets?.[0]).toMatchObject({
        task_id: 'platform-poll-test-shot-1',
        external_id: 'shot-1',
        metadata: {
          project_id: enriched.project_id,
          shot_id: 'shot-1',
          provider_job_id: 'platform-poll-test-shot-1',
        },
      });
      expect(body.metadata).toMatchObject({
        schema_version: 'seedance-provider-platform-poll/v1',
        project_id: enriched.project_id,
      });
      return new Response(JSON.stringify({
        data: {
          tasks: [{
            external_id: 'shot-1',
            task_id: 'platform-poll-test-shot-1',
            state: 'SUCCEEDED',
            output_url: 'https://example.com/seedance-videos/platform-poll-shot-1.mp4',
          }, {
            external_id: 'shot-2',
            task_id: 'platform-poll-test-shot-2',
            state: 'FAILED',
            code: 'NO_CREDIT',
            errorMessage: '余额不足',
          }],
        },
      }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const pollApplyRes = await pollProjectSeedanceProviderQueue(enriched.project_id!, {
      provider: 'seedance',
      queue_id: 'platform-poll-queue-001',
      use_provider_adapter: true,
      note: 'platform payload poll',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(pollApplyRes.ok).toBe(true);
    expect(pollApplyRes.data).toMatchObject({
      dry_run: false,
      updated_count: 2,
      provider_adapter: {
        request_mode: 'batch',
        queried_count: 2,
        returned_count: 2,
      },
    });
    expect(pollApplyRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-1'
    )).toMatchObject({
      status: 'ready',
      provider_job_id: 'platform-poll-test-shot-1',
      video_url: 'https://example.com/seedance-videos/platform-poll-shot-1.mp4',
    });
    expect(pollApplyRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-2'
    )).toMatchObject({
      status: 'failed',
      provider_job_id: 'platform-poll-test-shot-2',
      failure_category: 'provider_quota',
      provider_error_code: 'NO_CREDIT',
    });
  });

  it('queries a per-target Seedance provider adapter and applies single-task responses', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');
    process.env.SEEDANCE_PROVIDER_POLL_ENDPOINT = 'https://adapter.example.test/seedance/poll-one';
    process.env.SEEDANCE_PROVIDER_POLL_REQUEST_MODE = 'per_target';

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const submitRes = await submitProjectSeedanceShotsToProvider(enriched.project_id!, {
      shot_ids: ['shot-1', 'shot-2'],
      provider: 'seedance',
      job_prefix: 'provider-target-test',
      queue_id: 'provider-target-queue-001',
      note: 'provider target 测试提交',
    });
    expect(submitRes.ok).toBe(true);

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(String(_url)).toBe('https://adapter.example.test/seedance/poll-one');
      const body = JSON.parse(String(init?.body)) as {
        request_mode?: string;
        target?: { shot_id: string; provider_job_id?: string };
        targets?: Array<{ shot_id: string; provider_job_id?: string }>;
      };
      expect(body.request_mode).toBe('per_target');
      expect(body.target).toBeDefined();
      expect(body.targets).toHaveLength(1);
      if (body.target?.shot_id === 'shot-1') {
        return new Response(JSON.stringify({
          taskId: 'provider-target-test-shot-1',
          state: 'SUCCEEDED',
          outputUrl: 'https://example.com/seedance-videos/provider-target-shot-1.mp4',
        }));
      }
      return new Response(JSON.stringify({
        data: {
          task_id: 'provider-target-test-shot-2',
          task_status: 'FAILED',
          error_code: 'ACCESS_DENIED',
          error_message: '鉴权失败',
        },
      }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const pollApplyRes = await pollProjectSeedanceProviderQueue(enriched.project_id!, {
      provider: 'seedance',
      queue_id: 'provider-target-queue-001',
      include_prompt: true,
      use_provider_adapter: true,
      note: 'provider target 应用回传',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(pollApplyRes.ok).toBe(true);
    expect(pollApplyRes.data).toMatchObject({
      dry_run: false,
      updated_count: 2,
      provider_adapter: {
        request_mode: 'per_target',
        queried_count: 2,
        returned_count: 2,
      },
    });
    expect(pollApplyRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-1'
    )).toMatchObject({
      status: 'ready',
      provider_job_id: 'provider-target-test-shot-1',
      video_url: 'https://example.com/seedance-videos/provider-target-shot-1.mp4',
    });
    expect(pollApplyRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-2'
    )).toMatchObject({
      status: 'failed',
      provider_job_id: 'provider-target-test-shot-2',
      failure_category: 'provider_auth',
      provider_error_code: 'ACCESS_DENIED',
    });
  });

  it('queries a per-target Seedance provider adapter with GET endpoint templates', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');
    process.env.SEEDANCE_PROVIDER_POLL_ENDPOINT = 'https://adapter.example.test/tasks/{provider_job_id}?shot={shot_id}&queue={provider_queue_id}';
    process.env.SEEDANCE_PROVIDER_POLL_REQUEST_MODE = 'per_target';
    process.env.SEEDANCE_PROVIDER_POLL_HTTP_METHOD = 'GET';

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const submitRes = await submitProjectSeedanceShotsToProvider(enriched.project_id!, {
      shot_ids: ['shot-1', 'shot-2'],
      provider: 'seedance',
      job_prefix: 'provider-template-test',
      queue_id: 'provider-template-queue-001',
      note: 'provider template 测试提交',
    });
    expect(submitRes.ok).toBe(true);

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.method).toBe('GET');
      expect(init?.body).toBeUndefined();
      const url = String(_url);
      if (url.includes('provider-template-test-shot-1')) {
        expect(url).toBe('https://adapter.example.test/tasks/provider-template-test-shot-1?shot=shot-1&queue=provider-template-queue-001');
        return new Response(JSON.stringify({
          taskId: 'provider-template-test-shot-1',
          state: 'SUCCEEDED',
          outputUrl: 'https://example.com/seedance-videos/provider-template-shot-1.mp4',
        }));
      }
      expect(url).toBe('https://adapter.example.test/tasks/provider-template-test-shot-2?shot=shot-2&queue=provider-template-queue-001');
      return new Response(JSON.stringify({
        taskId: 'provider-template-test-shot-2',
        state: 'PROCESSING',
      }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const pollApplyRes = await pollProjectSeedanceProviderQueue(enriched.project_id!, {
      provider: 'seedance',
      queue_id: 'provider-template-queue-001',
      include_prompt: true,
      use_provider_adapter: true,
      note: 'provider template 应用回传',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(pollApplyRes.ok).toBe(true);
    expect(pollApplyRes.data).toMatchObject({
      updated_count: 2,
      provider_adapter: {
        request_mode: 'per_target',
        http_method: 'GET',
        queried_count: 2,
        returned_count: 2,
      },
    });
    expect(pollApplyRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-1'
    )).toMatchObject({
      status: 'ready',
      provider_job_id: 'provider-template-test-shot-1',
      video_url: 'https://example.com/seedance-videos/provider-template-shot-1.mp4',
    });
    expect(pollApplyRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-2'
    )).toMatchObject({
      status: 'processing',
      provider_job_id: 'provider-template-test-shot-2',
    });
  });

  it('exports a production board package to the project directory', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const exportRes = await exportProjectProductionBoard(enriched.project_id!);

    expect(exportRes.ok).toBe(true);
    expect(exportRes.data?.schema_version).toBe('story-production-board-export/v1');
    expect(exportRes.data?.project_id).toBe(enriched.project_id);
    expect(exportRes.data?.files.map(file => file.relative_path)).toEqual(expect.arrayContaining([
      'production-board/manifest.json',
      'production-board/production-board.json',
      'production-board/production-board.md',
      'production-board/supervision-report.json',
      'production-board/repair-plan.json',
      'production-board/seedance-prompts.json',
      'production-board/seedance-prompts.md',
      'production-board/seedance-asset-report.json',
      'production-board/seedance-asset-report.md',
      'production-board/seedance-shot-ledger.json',
      'production-board/seedance-shot-ledger.md',
    ]));

    const exportDir = resolve(root, 'web', 'generated', 'projects', enriched.project_id!, 'production-board');
    expect(await exists(resolve(exportDir, 'manifest.json'))).toBe(true);
    expect(await exists(resolve(exportDir, 'production-board.json'))).toBe(true);
    expect(await exists(resolve(exportDir, 'seedance-prompts.md'))).toBe(true);
    expect(await exists(resolve(exportDir, 'seedance-asset-report.md'))).toBe(true);
    expect(await exists(resolve(exportDir, 'seedance-shot-ledger.md'))).toBe(true);

    const manifest = JSON.parse(await readFile(resolve(exportDir, 'manifest.json'), 'utf-8'));
    expect(manifest.schema_version).toBe('story-production-board-manifest/v1');
    expect(manifest.delivery_manifest.artifacts.map((artifact: { kind: string }) => artifact.kind)).toContain('seedance_prompts');
    expect(manifest.delivery_manifest.artifacts.map((artifact: { kind: string }) => artifact.kind)).toContain('seedance_asset_report');
    expect(manifest.delivery_manifest.artifacts.map((artifact: { kind: string }) => artifact.kind)).toContain('seedance_shot_ledger');

    const seedanceMarkdown = await readFile(resolve(exportDir, 'seedance-prompts.md'), 'utf-8');
    expect(seedanceMarkdown).toContain('Seedance 2.0 镜头提示词');
    expect(seedanceMarkdown).toContain('0-3秒');
    expect(seedanceMarkdown).toContain('素材 slot');
    const seedanceJson = JSON.parse(await readFile(resolve(exportDir, 'seedance-prompts.json'), 'utf-8'));
    expect(seedanceJson.shot_units[0].asset_slots.length).toBeGreaterThan(0);
    expect(seedanceJson.shot_units[0].material_validation.prompt_complexity_score).toBeGreaterThan(0);
    const seedanceAssetReport = JSON.parse(await readFile(resolve(exportDir, 'seedance-asset-report.json'), 'utf-8'));
    expect(seedanceAssetReport.schema_version).toBe('seedance-asset-report/v1');
    expect(seedanceAssetReport.assets[0].status).toBe('missing_file');
    expect(seedanceAssetReport.markdown).toContain('Seedance 素材缺口报告');
    expect(seedanceAssetReport.markdown).toContain('## 上传清单');
    expect(seedanceAssetReport.upload_required_count).toBeGreaterThan(0);
    expect(seedanceAssetReport.upload_checklist.length).toBe(seedanceAssetReport.upload_required_count);
    expect(seedanceAssetReport.upload_checklist[0]).toMatchObject({
      needs_upload: true,
      suggested_filename: expect.any(String),
      checklist_note: expect.any(String),
    });
    expect(seedanceAssetReport.upload_checklist[0].acceptance_criteria.length).toBeGreaterThan(0);
    if (manifest.delivery_manifest.stage === 'ready') {
      expect(manifest.delivery_manifest.next_action).toContain('上传/绑定');
      expect(manifest.delivery_manifest.next_action).toContain(String(seedanceAssetReport.upload_required_count));
    }
    const seedanceShotLedger = JSON.parse(await readFile(resolve(exportDir, 'seedance-shot-ledger.json'), 'utf-8'));
    expect(seedanceShotLedger.schema_version).toBe('seedance-shot-ledger/v1');
    expect(seedanceShotLedger.items[0].status).toBe('prompt_exported');
    const seedanceShotLedgerMarkdown = await readFile(resolve(exportDir, 'seedance-shot-ledger.md'), 'utf-8');
    expect(seedanceShotLedgerMarkdown).toContain('Seedance Shot Ledger');

    const detail = await getProject(enriched.project_id!);
    expect(detail.data?.project.status).toBe('exported');
    expect(detail.data?.versions[0].production_board_export).toMatchObject({
      file_count: 11,
      delivery_stage: exportRes.data?.board.delivery_manifest.stage,
    });
  });

  it('keeps internal quality labels out of production board delivery prompts', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const baseStory = makeStory();
    const story: StoryGenerateResult = {
      ...baseStory,
      quality_report: {
        ...baseStory.quality_report!,
        issues: [
          '补强「人物高光选择」质量信号：目标明确',
          '必须有主角目标',
          '对齐历史因果讲述：因果链清楚',
          '史实边界明确',
        ],
      },
      scene_breakdown: baseStory.scene_breakdown.map(scene => scene.scene_id === 1
        ? {
            ...scene,
            visual_prompt: '质量信号：目标明确；来源显示：知识库；烛火、案卷、未签的判词',
            camera_suggestion: '注意：近景切入',
            cultural_note: '来源显示：基于知识库条目，具体细节请核实来源。',
            factual_basis: '史实边界明确：周敦颐拒签冤案来自知识库。',
            fictionalized_elements: ['影视化创作：雨夜停笔动作'],
          }
        : scene),
      gears_segments: baseStory.gears_segments.map(segment => segment.source_scene_id === 1
        ? {
            ...segment,
            script_text: '质量信号：行动具体；片尾说清创作边界。保留案卷、烛火和停笔动作。',
            segment_prompt_hint: '补强质量信号：行动具体；保留案卷、烛火和停笔动作。',
            cultural_constraints: ['来源条目：周敦颐——理学开山鼻祖', '史实依据：拒签冤案'],
          }
        : segment),
    };
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const exportRes = await exportProjectProductionBoard(enriched.project_id!);

    expect(exportRes.ok).toBe(true);
    const detail = await getProject(enriched.project_id!);
    const storedQualityText = detail.data?.current_story.quality_report?.issues.join('\n') ?? '';
    expect(storedQualityText).toMatch(/质量信号|主角目标|因果链|史实边界/);

    const exportDir = resolve(root, 'web', 'generated', 'projects', enriched.project_id!, 'production-board');
    const boardJson = JSON.parse(await readFile(resolve(exportDir, 'production-board.json'), 'utf-8'));
    const boardMarkdown = await readFile(resolve(exportDir, 'production-board.md'), 'utf-8');
    const seedanceJson = JSON.parse(await readFile(resolve(exportDir, 'seedance-prompts.json'), 'utf-8'));
    const seedanceMarkdown = await readFile(resolve(exportDir, 'seedance-prompts.md'), 'utf-8');
    const boardDeliveryText = boardJson.shot_units.flatMap((unit: {
      script_text: string;
      visual_prompt: string;
      camera_suggestion: string;
      production_prompt: string;
      seedance_prompt: string;
      cultural_boundary: string;
      continuity_notes: string[];
    }) => [
      unit.script_text,
      unit.visual_prompt,
      unit.camera_suggestion,
      unit.production_prompt,
      unit.seedance_prompt,
      unit.cultural_boundary,
      ...(unit.continuity_notes ?? []),
    ]).join('\n');
    const boardBoundaryText = [
      ...(boardJson.continuity_constraints ?? []),
      ...boardJson.shot_units.map((unit: { cultural_boundary: string }) => unit.cultural_boundary),
    ].join('\n');
    const boardAssetText = [
      ...boardJson.character_assets.flatMap((asset: {
        appearance_features: string;
        clothing: string;
        carried_props?: string;
        signature_objects?: string;
        background_oneliner?: string;
      }) => [
        asset.appearance_features,
        asset.clothing,
        asset.carried_props ?? '',
        asset.signature_objects ?? '',
        asset.background_oneliner ?? '',
      ]),
      ...boardJson.location_assets.flatMap((asset: {
        description: string;
        environment_props?: string;
      }) => [
        asset.description,
        asset.environment_props ?? '',
      ]),
      ...boardJson.costume_assets.map((asset: { clothing: string; continuity_note: string }) =>
        `${asset.clothing}\n${asset.continuity_note}`
      ),
      ...boardJson.prop_assets.map((asset: { usage_note: string }) => asset.usage_note),
    ].join('\n');
    const seedancePromptText = seedanceJson.shot_units
      .map((unit: { prompt: string }) => unit.prompt)
      .join('\n');
    const seedancePreviewText = boardJson.seedance_asset_report.shots
      .map((shot: { prompt_preview: string }) => shot.prompt_preview)
      .join('\n');

    expect(boardDeliveryText).toContain('烛火');
    expect(boardDeliveryText).toContain('案卷');
    expect(boardDeliveryText).toContain('0-3秒');
    expect(boardDeliveryText).not.toMatch(DELIVERY_PROMPT_INTERNAL_PATTERN);
    expect(boardBoundaryText).not.toMatch(DELIVERY_PROMPT_INTERNAL_PATTERN);
    expect(boardAssetText).not.toMatch(DELIVERY_PROMPT_INTERNAL_PATTERN);
    expect(boardJson.markdown).not.toMatch(DELIVERY_PROMPT_INTERNAL_PATTERN);
    expect(boardMarkdown).not.toMatch(DELIVERY_PROMPT_INTERNAL_PATTERN);
    expect(seedancePromptText).not.toMatch(DELIVERY_PROMPT_INTERNAL_PATTERN);
    expect(seedancePreviewText).not.toMatch(DELIVERY_PROMPT_INTERNAL_PATTERN);
    expect(seedanceMarkdown).not.toMatch(DELIVERY_PROMPT_INTERNAL_PATTERN);
  });

  it('repairs production board issues and exports the repaired package in one step', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const baseStory = makeStory();
    const story: StoryGenerateResult = {
      ...baseStory,
      scene_breakdown: baseStory.scene_breakdown.map(scene => scene.scene_id === 1
        ? {
            ...scene,
            visual_prompt: `质量：待补；${scene.visual_prompt}`,
          }
        : scene),
    };
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');

    const result = await repairAndExportProjectProductionBoard(enriched.project_id!, {
      apply_all: true,
    });

    expect(result.ok).toBe(true);
    expect(result.data?.schema_version).toBe('story-production-board-repair-export/v1');
    expect(result.data?.repair.trace.applied).toBe(true);
    expect(result.data?.repair.trace.applied_actions).toContain('clean_prompt');
    expect(result.data?.detail.project.status).toBe('exported');
    expect(result.data?.detail.project.version_count).toBe(2);
    expect(result.data?.detail.versions[0].production_board_repair_trace?.applied).toBe(true);
    expect(result.data?.detail.versions[0].production_board_repair_trace?.applied_actions).toContain('clean_prompt');
    expect(result.data?.detail.versions[0].production_board_export).toMatchObject({
      file_count: result.data?.export_package.files.length,
      delivery_stage: result.data?.export_package.board.delivery_manifest.stage,
    });
    expect(result.data?.detail.current_story.scene_breakdown[0].visual_prompt).not.toMatch(/质量|待补/);
    expect(result.data?.export_package.files.map(file => file.relative_path)).toEqual(expect.arrayContaining([
      'production-board/manifest.json',
      'production-board/production-board.json',
      'production-board/seedance-prompts.md',
    ]));
    expect(result.data?.export_package.board.shot_units[0].visual_prompt).not.toMatch(/质量|待补/);

    const exportDir = resolve(root, 'web', 'generated', 'projects', enriched.project_id!, 'production-board');
    expect(await exists(resolve(exportDir, 'manifest.json'))).toBe(true);
    expect(await exists(resolve(exportDir, 'production-board.json'))).toBe(true);
  });

  it('repairs production board blockers into a new project version', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story: StoryGenerateResult = {
      ...makeStory(),
      gears_delivery: {
        schema_version: 'gears-delivery/v1',
        storyId: '20260609-story-abc1',
        title: '拒签冤案',
        character_assets: [
          {
            name: '周敦颐',
            role_position: '主角',
            species_type: '人类',
            ethnicity: ['东亚'],
            gender: '男',
            age_range: '青年',
            appearance_features: '青年士人，神情克制',
            clothing: '清末民初至五四前后中国青年固定服装：朴素学生长衫或短褂布鞋',
          },
          {
            name: '上官',
            role_position: '配角',
            species_type: '人类',
            ethnicity: ['东亚'],
            gender: '男',
            age_range: '中年',
            appearance_features: '中年官员，目光压迫',
            clothing: '清末民初至五四前后中国青年固定服装：朴素学生长衫或短褂布鞋',
          },
        ],
        character_gender_summary: {
          total: 2,
          male: 2,
          female: 0,
          other: 0,
          unspecified: 0,
          not_applicable: 0,
        },
        scene_assets: [{
          name: '南安军衙',
          scene_type: '室内',
          description: '衙署案桌、烛火、案卷',
          atmosphere: '紧张',
        }],
        units: [],
        validation_notes: [],
        markdown: '# GEARS',
      },
    };
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const beforeBoard = await getProjectProductionBoard(enriched.project_id!);
    expect(beforeBoard.data?.supervision_report.blockers).toBeGreaterThan(0);

    const repairRes = await repairProjectProductionBoard(enriched.project_id!, { priorities: ['P0'] });

    expect(repairRes.ok).toBe(true);
    expect(repairRes.data?.schema_version).toBe('story-production-board-repair/v1');
    expect(repairRes.data?.trace.applied).toBe(true);
    expect(repairRes.data?.trace.applied_actions).toContain('normalize_period_costumes');
    expect(repairRes.data?.trace.after_blockers).toBeLessThan(repairRes.data?.trace.before_blockers ?? 999);
    expect(repairRes.data?.detail.project.version_count).toBe(2);
    expect(repairRes.data?.detail.versions[0].change_type).toBe('production_board_repair');
    expect(repairRes.data?.detail.versions[0].production_board_repair_trace?.applied_actions).toContain('normalize_period_costumes');
    expect(repairRes.data?.detail.versions[0].production_board_export).toBeUndefined();
    expect(repairRes.data?.detail.current_story.gears_delivery?.character_assets[0].clothing).toContain('宋代');
    expect(repairRes.data?.after_board.character_assets[0].clothing).toContain('宋代');
  });

  it('repairs only the requested production board task id', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const baseStory = makeStory();
    const story: StoryGenerateResult = {
      ...baseStory,
      scene_breakdown: baseStory.scene_breakdown.map(scene => scene.scene_id === 1
        ? {
            ...scene,
            visual_prompt: `质量：待补；${scene.visual_prompt}`,
          }
        : scene),
      gears_delivery: {
        schema_version: 'gears-delivery/v1',
        storyId: baseStory.storyId,
        title: baseStory.title,
        character_assets: [
          {
            name: '周敦颐',
            role_position: '主角',
            species_type: '人类',
            ethnicity: ['东亚'],
            gender: '男',
            age_range: '青年',
            appearance_features: '青年士人，神情克制',
            clothing: '清末民初至五四前后中国青年固定服装：朴素学生长衫或短褂布鞋',
          },
        ],
        character_gender_summary: {
          total: 1,
          male: 1,
          female: 0,
          other: 0,
          unspecified: 0,
          not_applicable: 0,
        },
        scene_assets: [{
          name: '南安军衙',
          scene_type: '室内',
          description: '衙署案桌、烛火、案卷',
          atmosphere: '紧张',
        }],
        units: [],
        validation_notes: [],
        markdown: '# GEARS',
      },
    };
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const beforeBoard = await getProjectProductionBoard(enriched.project_id!);
    const cleanPromptTask = beforeBoard.data?.repair_plan.tasks.find(task => task.action === 'clean_prompt');

    expect(cleanPromptTask).toBeTruthy();
    expect(beforeBoard.data?.repair_plan.tasks.some(task => task.action === 'normalize_period_costumes')).toBe(true);

    const repairRes = await repairProjectProductionBoard(enriched.project_id!, {
      task_ids: [cleanPromptTask!.task_id],
    });

    expect(repairRes.ok).toBe(true);
    expect(repairRes.data?.trace.applied_task_ids).toEqual([cleanPromptTask!.task_id]);
    expect(repairRes.data?.trace.applied_actions).toEqual(['clean_prompt']);
    expect(repairRes.data?.trace.applied_task_ids).not.toContain('repair-normalize_period_costumes');
    expect(repairRes.data?.detail.project.version_count).toBe(2);
    expect(repairRes.data?.detail.current_story.scene_breakdown[0].visual_prompt).not.toMatch(/质量|待补/);
    expect(repairRes.data?.detail.current_story.gears_delivery?.character_assets[0].clothing).toContain('清末民初');
    expect(repairRes.data?.after_board.supervision_report.issues.some(issue => issue.category === 'period')).toBe(true);
  });

  it('repairs only the requested production board issue category', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const baseStory = makeStory();
    const story: StoryGenerateResult = {
      ...baseStory,
      storyId: '20260609-story-cat1',
      gears_segments_url: '/api/stories/20260609-story-cat1/gears-segments',
      scene_breakdown: baseStory.scene_breakdown.map(scene => scene.scene_id === 1
        ? {
            ...scene,
            visual_prompt: `质量：待补；${scene.visual_prompt}`,
          }
        : scene),
      gears_delivery: {
        schema_version: 'gears-delivery/v1',
        storyId: '20260609-story-cat1',
        title: baseStory.title,
        character_assets: [
          {
            name: '周敦颐',
            role_position: '主角',
            species_type: '人类',
            ethnicity: ['东亚'],
            gender: '男',
            age_range: '青年',
            appearance_features: '青年士人，神情克制',
            clothing: '清末民初至五四前后中国青年固定服装：朴素学生长衫或短褂布鞋',
          },
        ],
        character_gender_summary: {
          total: 1,
          male: 1,
          female: 0,
          other: 0,
          unspecified: 0,
          not_applicable: 0,
        },
        scene_assets: [{
          name: '南安军衙',
          scene_type: '室内',
          description: '衙署案桌、烛火、案卷',
          atmosphere: '紧张',
        }],
        units: [],
        validation_notes: [],
        markdown: '# GEARS',
      },
    };
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const beforeBoard = await getProjectProductionBoard(enriched.project_id!);
    expect(beforeBoard.data?.repair_plan.tasks.some(task => task.action === 'clean_prompt')).toBe(true);
    expect(beforeBoard.data?.repair_plan.tasks.some(task => task.action === 'normalize_period_costumes')).toBe(true);

    const repairRes = await repairProjectProductionBoard(enriched.project_id!, {
      categories: ['prompt'],
    });

    expect(repairRes.ok).toBe(true);
    expect(repairRes.data?.trace.applied_actions).toEqual(['clean_prompt']);
    expect(repairRes.data?.trace.applied_actions).not.toContain('normalize_period_costumes');
    expect(repairRes.data?.detail.current_story.scene_breakdown[0].visual_prompt).not.toMatch(/质量|待补/);
    expect(repairRes.data?.detail.current_story.gears_delivery?.character_assets[0].clothing).toContain('清末民初');
  });

  it('narrows production board repair to the requested shot target', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const baseStory = makeStory();
    const story: StoryGenerateResult = {
      ...baseStory,
      storyId: '20260609-story-shot1',
      gears_segments_url: '/api/stories/20260609-story-shot1/gears-segments',
      scene_breakdown: baseStory.scene_breakdown.map(scene => ({
        ...scene,
        visual_prompt: `质量：待补；${scene.visual_prompt}`,
      })),
    };
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const beforeBoard = await getProjectProductionBoard(enriched.project_id!);
    const cleanPromptTask = beforeBoard.data?.repair_plan.tasks.find(task => task.action === 'clean_prompt');
    const targetShotId = cleanPromptTask?.target_shot_ids[0];
    const targetSceneId = cleanPromptTask?.target_scene_ids[0];
    const untouchedSceneId = cleanPromptTask?.target_scene_ids.find(sceneId => sceneId !== targetSceneId);

    expect(targetShotId).toBeTruthy();
    expect(targetSceneId).toBeTruthy();
    expect(untouchedSceneId).toBeTruthy();

    const repairRes = await repairProjectProductionBoard(enriched.project_id!, {
      shot_ids: [targetShotId!],
      scene_ids: [targetSceneId!],
    });

    expect(repairRes.ok).toBe(true);
    expect(repairRes.data?.trace.applied_actions).toContain('clean_prompt');
    expect(repairRes.data?.trace.changed_scene_ids).toEqual([targetSceneId]);
    expect(repairRes.data?.trace.scene_diffs).toHaveLength(1);
    expect(repairRes.data?.trace.scene_diffs[0].scene_id).toBe(targetSceneId);
    expect(repairRes.data?.trace.scene_diffs[0].changed_fields.map(field => field.field)).toContain('visual_prompt');
    const scenes = repairRes.data?.detail.current_story.scene_breakdown ?? [];
    expect(scenes.find(scene => scene.scene_id === targetSceneId)?.visual_prompt).not.toMatch(/质量|待补/);
    expect(scenes.find(scene => scene.scene_id === untouchedSceneId)?.visual_prompt).toMatch(/质量|待补/);
  });

  it('does not create a project version when production board repair changes nothing', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');

    const repairRes = await repairProjectProductionBoard(enriched.project_id!, {
      task_ids: ['repair-task-that-does-not-exist'],
    });

    expect(repairRes.ok).toBe(true);
    expect(repairRes.data?.trace.applied).toBe(false);
    expect(repairRes.data?.trace.applied_task_ids).toEqual([]);
    expect(repairRes.data?.detail.project.version_count).toBe(1);
    expect(repairRes.data?.detail.versions).toHaveLength(1);

    const detail = await getProject(enriched.project_id!);
    expect(detail.data?.project.version_count).toBe(1);
    expect(detail.data?.versions.map(version => version.change_type)).toEqual(['initial_generation']);
  });

  it('updates GEARS webhook status on the current project and source story file', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story: StoryGenerateResult = {
      ...makeStory(),
      gears_webhook: {
        status: 'pending',
        webhook_target: 'https://grears.example/api/webhook/story-ready',
      },
    };
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const storyDir = resolve(root, 'web', 'generated', 'stories', story.video_type);
    const storyPath = resolve(storyDir, `${story.storyId}.json`);
    await mkdir(storyDir, { recursive: true });
    await writeFile(storyPath, JSON.stringify({
      ...story,
      project_id: enriched.project_id,
      current_version_id: enriched.current_version_id,
      _request_meta: { created_at: '2026-06-09T10:00:00.000Z' },
    }, null, 2), 'utf-8');

    await updateProjectCurrentGearsWebhookStatus(enriched.project_id, story.storyId, {
      status: 'sent',
      webhook_target: 'https://grears.example/api/webhook/story-ready',
      attempts: 1,
      last_attempt_at: '2026-06-09T10:00:01.000Z',
      last_success_at: '2026-06-09T10:00:01.000Z',
    });

    const detail = await getProject(enriched.project_id!);
    expect(detail.ok).toBe(true);
    expect(detail.data?.current_story.gears_webhook?.status).toBe('sent');
    expect(detail.data?.current_story.gears_webhook?.attempts).toBe(1);

    const rawSource = JSON.parse(await readFile(storyPath, 'utf-8')) as StoryGenerateResult;
    expect(rawSource.gears_webhook?.status).toBe('sent');
    expect(rawSource.gears_webhook?.last_success_at).toBe('2026-06-09T10:00:01.000Z');
  });

  it('tracks open supplement task count on project metadata', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story: StoryGenerateResult = {
      ...makeStory(),
      supplement_tasks: [{
        task_id: '20260609-story-abc1--supplement--supporting_characters',
        need_id: 'supporting_characters',
        label: '配角人物',
        description: '补充「配角人物」相关资料',
        status: 'open',
        source: 'knowledge_pack_missing_need',
        created_at: '2026-06-09T10:00:00.000Z',
      }],
    };
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const detail = await getProject(enriched.project_id!);

    expect(detail.ok).toBe(true);
    expect(detail.data?.project.open_supplement_task_count).toBe(1);
    expect(detail.data?.current_story.supplement_tasks?.[0].status).toBe('open');
  });

  it('lists supplement tasks across projects with status filtering', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story: StoryGenerateResult = {
      ...makeStory(),
      supplement_tasks: [
        {
          task_id: '20260609-story-abc1--supplement--supporting_characters',
          need_id: 'supporting_characters',
          label: '配角人物',
          description: '补充「配角人物」相关资料',
          stage: 'script_ready',
          blocking_level: 'blocking',
          affects: ['full_text', 'quality_report'],
          recommended_question: '请补充配角人物关系。',
          status: 'open',
          source: 'knowledge_pack_missing_need',
          created_at: '2026-06-09T10:00:00.000Z',
        },
        {
          task_id: '20260609-story-abc1--supplement--regional_context',
          need_id: 'regional_context',
          label: '地域背景',
          description: '补充「地域背景」相关资料',
          stage: 'production_ready',
          blocking_level: 'optional',
          affects: ['asset_handoff'],
          recommended_question: '请补充地域视觉规范。',
          status: 'resolved',
          source: 'material_sufficiency_missing_item',
          created_at: '2026-06-09T10:00:00.000Z',
          resolved_at: '2026-06-09T11:00:00.000Z',
          supplement_note: '已补充地域背景。',
        },
      ],
    };
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');

    const allTasks = await listProjectSupplementTasks();
    const openTasks = await listProjectSupplementTasks('open');
    const scriptReadyTasks = await listProjectSupplementTasks({ stage: 'script_ready' });
    const blockingTasks = await listProjectSupplementTasks({ blocking_level: 'blocking' });
    const materialGateTasks = await listProjectSupplementTasks({ source: 'material_sufficiency_missing_item' });
    const projectTasks = await listProjectSupplementTasks({ project_id: enriched.project_id });

    expect(allTasks.ok).toBe(true);
    expect(allTasks.data).toHaveLength(2);
    expect(allTasks.data?.[0].task.blocking_level).toBe('blocking');
    expect(openTasks.ok).toBe(true);
    expect(openTasks.data).toHaveLength(1);
    expect(openTasks.data?.[0].project_title).toBe(story.title);
    expect(openTasks.data?.[0].task.status).toBe('open');
    expect(scriptReadyTasks.data?.map(item => item.task.need_id)).toEqual(['supporting_characters']);
    expect(blockingTasks.data?.map(item => item.task.need_id)).toEqual(['supporting_characters']);
    expect(materialGateTasks.data?.map(item => item.task.need_id)).toEqual(['regional_context']);
    expect(projectTasks.data?.map(item => item.project_id)).toEqual([enriched.project_id, enriched.project_id]);
  });

  it('updates supplement task status on the current project and source story file', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const taskId = '20260609-story-abc1--supplement--supporting_characters';
    const story: StoryGenerateResult = {
      ...makeStory(),
      supplement_tasks: [{
        task_id: taskId,
        need_id: 'supporting_characters',
        label: '配角人物',
        description: '补充「配角人物」相关资料',
        status: 'open',
        source: 'knowledge_pack_missing_need',
        created_at: '2026-06-09T10:00:00.000Z',
      }],
    };
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const storyDir = resolve(root, 'web', 'generated', 'stories', story.video_type);
    const storyPath = resolve(storyDir, `${story.storyId}.json`);
    await mkdir(storyDir, { recursive: true });
    await writeFile(storyPath, JSON.stringify({
      ...story,
      project_id: enriched.project_id,
      current_version_id: enriched.current_version_id,
      _request_meta: { created_at: '2026-06-09T10:00:00.000Z' },
    }, null, 2), 'utf-8');

    const updated = await updateProjectSupplementTask(enriched.project_id!, taskId, {
      status: 'resolved',
      supplement_note: '上官可设定为南安军衙主管，负责催促签署疑案文书。',
    });

    expect(updated.ok).toBe(true);
    expect(updated.data?.project.open_supplement_task_count).toBe(0);
    expect(updated.data?.current_story.supplement_tasks?.[0].status).toBe('resolved');
    expect(updated.data?.current_story.supplement_tasks?.[0].resolved_at).toBeTruthy();
    expect(updated.data?.current_story.supplement_tasks?.[0].supplement_note).toContain('南安军衙主管');
    expect(updated.data?.current_story.material_pack?.supporting_materials.some(material => (
      material.material_id === 'supplement-supporting_characters'
      && material.summary.includes('南安军衙主管')
      && material.purpose.includes('character_source')
    ))).toBe(true);
    expect(updated.data?.current_story.material_sufficiency?.schema_version).toBe('material-sufficiency/v1');
    expect(updated.data?.current_story.creation_contract?.material_sufficiency.score).toBe(updated.data?.current_story.material_sufficiency?.score);
    expect(updated.data?.project.material_sufficiency?.score).toBe(updated.data?.current_story.material_sufficiency?.score);

    const rawSource = JSON.parse(await readFile(storyPath, 'utf-8')) as StoryGenerateResult;
    expect(rawSource.supplement_tasks?.[0].status).toBe('resolved');
    expect(rawSource.supplement_tasks?.[0].supplement_note).toContain('疑案文书');
    expect(rawSource.material_pack?.supporting_materials.some(material => material.summary.includes('疑案文书'))).toBe(true);
    expect(rawSource.material_sufficiency?.schema_version).toBe('material-sufficiency/v1');
  });

  it('refreshes production material readiness after resolving production material supplement tasks', async () => {
    const productionPack = getProductionMaterialPack('ai_comic_drama');
    expect(productionPack).toBeTruthy();

    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const materialPack: StoryGenerateResult['material_pack'] = {
      schema_version: 'material-pack/v1',
      primary_materials: [{
        material_id: 'ai-comic-core',
        title: '青石巷 AI 漫剧设定',
        summary: '第一格钩子、世界观、主角目标、对手压力、关系碰撞、场景锚点、对白气泡、情绪节拍、镜头提示词分层、结尾钩子和禁用边界已整理。',
        source_type: 'manual_note',
        purpose: ['fact_basis', 'visual_asset', 'creative_boundary'],
        confidence: 0.72,
        tags: ['AI漫剧', '青石巷'],
      }],
      supporting_materials: [],
      reference_materials: [],
      visual_assets: [],
      verified_facts: ['虚构边界：本项目为 fictional_original，不声称为真实史实。'],
      uncertain_claims: ['画面基准待补。'],
      creative_space: ['可用漫画分镜方式表现青石巷追问。'],
      missing_needs: [{
        need_id: 'production_template_reference_images_or_keyframes',
        label: '画面基准',
        message: '需要补充角色图像基准。',
      }],
      overall_confidence: 0.72,
    };
    const initialReadiness = buildProductionMaterialReadinessReport({
      productionMaterialPack: productionPack!,
      materialPack,
      contextText: 'AI漫剧，第一格钩子，世界观，主角目标，场景锚点。',
    });
    expect(initialReadiness?.missing_fields.map(field => field.field_id)).toContain('reference_images_or_keyframes');

    const taskId = '20260609-story-abc1--production-template--reference_images_or_keyframes';
    const baseStory = makeStory();
    const story: StoryGenerateResult = {
      ...baseStory,
      storyId: '20260609-story-ai-comic',
      title: '青石巷追问',
      video_type: 'ai_comic_drama',
      source_entry: '青石巷漫剧测试条目',
      knowledge_pack: {
        primary_entries: [{
          entry_name: '青石巷漫剧测试条目',
          province: '湖南',
          region: '长沙',
          type: 'AI漫剧测试素材',
          summary: '青石巷漫剧测试条目用于验证生产素材候选稿写回。',
          score: 0.9,
          role_in_story: '主素材',
          match_reason: '测试目标条目',
          keywords: ['青石巷', 'AI漫剧'],
        }],
        supporting_entries: [],
        missing_needs: [],
        overall_confidence: 0.72,
      },
      material_pack: materialPack,
      production_material_pack: productionPack,
      production_material_readiness: initialReadiness,
      creation_use_case: 'original_ai_comic',
      truth_mode: 'fictional_original',
      quality_report: {
        ...baseStory.quality_report!,
        video_type: 'ai_comic_drama',
        genre_score: 82,
      },
      gears_segments: baseStory.gears_segments.map(segment => ({
        ...segment,
        video_type: 'ai_comic_drama',
      })),
      supplement_tasks: [{
        task_id: taskId,
        need_id: 'production_template_reference_images_or_keyframes',
        label: '参考图或关键帧',
        description: '补齐「AI漫剧」生产模板字段「参考图或关键帧」。',
        stage: 'production_ready',
        blocking_level: 'risk',
        affects: ['production_material_readiness', 'gears_delivery'],
        recommended_fields: ['reference_images_or_keyframes'],
        recommended_question: '请补充角色参考图、关键帧或画面基准。',
        status: 'open',
        source: 'production_material_missing_field',
        created_at: '2026-06-09T10:00:00.000Z',
      }],
    };
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const storyDir = resolve(root, 'web', 'generated', 'stories', story.video_type);
    const storyPath = resolve(storyDir, `${story.storyId}.json`);
    await mkdir(storyDir, { recursive: true });
    await writeFile(storyPath, JSON.stringify({
      ...story,
      project_id: enriched.project_id,
      current_version_id: enriched.current_version_id,
      _request_meta: { created_at: '2026-06-09T10:00:00.000Z' },
    }, null, 2), 'utf-8');

    const updated = await updateProjectSupplementTask(enriched.project_id!, taskId, {
      status: 'resolved',
      supplement_field_values: {
        reference_images_or_keyframes: '参考图：主角青绿色短袄、银色发簪、圆眼漫画脸；关键帧：巷口回头、手中木牌特写、雨后青石反光。',
      },
    });

    const refreshedReadiness = updated.data?.current_story.production_material_readiness;
    expect(updated.ok).toBe(true);
    expect(refreshedReadiness?.score).toBeGreaterThan(initialReadiness!.score);
    expect(refreshedReadiness?.available_fields).toContain('reference_images_or_keyframes');
    expect(refreshedReadiness?.missing_fields.some(field => field.field_id === 'reference_images_or_keyframes')).toBe(false);
    expect(updated.data?.current_story.supplement_tasks?.[0].supplement_field_values?.reference_images_or_keyframes)
      .toContain('银色发簪');
    expect(updated.data?.current_story.supplement_tasks?.[0].supplement_note).toContain('reference images or keyframes');
    expect(updated.data?.current_story.supplement_tasks?.[0].knowledge_candidate_markdown).toContain('知识库候选稿');
    expect(updated.data?.current_story.supplement_tasks?.[0].knowledge_candidate_markdown).toContain('待人工核实');
    expect(updated.data?.current_story.supplement_tasks?.[0].knowledge_candidate_review_status).toBe('pending_review');
    expect(updated.data?.current_story.quality_report?.production_material_readiness_report?.missing_risk_fields.some(field => (
      field.field_id === 'reference_images_or_keyframes'
    ))).toBe(false);
    expect(updated.data?.current_story.material_pack?.supporting_materials.some(material => (
      material.material_id === 'supplement-production_template_reference_images_or_keyframes'
      && material.purpose.includes('visual_asset')
      && material.tags?.includes('reference_images_or_keyframes')
      && material.summary.includes('关键帧')
    ))).toBe(true);

    const prematureQueue = await updateProjectSupplementTask(enriched.project_id!, taskId, {
      status: 'resolved',
      knowledge_writeback_status: 'queued',
      knowledge_writeback_note: '不应绕过候选稿审稿。',
    });
    expect(prematureQueue.ok).toBe(false);
    expect(prematureQueue.error?.message).toContain('candidate is approved');

    const prematureQueuedTasks = await listProjectSupplementTasks({
      project_id: enriched.project_id,
      knowledge_writeback_status: 'queued',
    });
    expect(prematureQueuedTasks.ok).toBe(true);
    expect(prematureQueuedTasks.data).toEqual([]);

    const prematureReadyTasks = await listProjectSupplementTasks({
      project_id: enriched.project_id,
      knowledge_writeback_ready: true,
    });
    expect(prematureReadyTasks.ok).toBe(true);
    expect(prematureReadyTasks.data).toEqual([]);

    const reviewed = await updateProjectSupplementTask(enriched.project_id!, taskId, {
      status: 'resolved',
      knowledge_candidate_review_status: 'approved',
      knowledge_candidate_review_note: '画面基准可进入正式写入草案，来源仍待补。',
    });
    expect(reviewed.ok).toBe(true);
    expect(reviewed.data?.current_story.supplement_tasks?.[0].knowledge_candidate_review_status).toBe('approved');
    expect(reviewed.data?.current_story.supplement_tasks?.[0].knowledge_writeback_draft_markdown).toContain('正式知识库写入草案');
    expect(reviewed.data?.current_story.supplement_tasks?.[0].knowledge_writeback_draft_markdown).toContain('核实方法');
    expect(reviewed.data?.current_story.supplement_tasks?.[0].knowledge_writeback_status).toBe('draft_ready');

    const draftReadyTasks = await listProjectSupplementTasks({
      project_id: enriched.project_id,
      knowledge_writeback_status: 'draft_ready',
    });
    expect(draftReadyTasks.ok).toBe(true);
    expect(draftReadyTasks.data?.map(item => item.task.task_id)).toEqual([taskId]);

    const writebackReadyTasks = await listProjectSupplementTasks({
      project_id: enriched.project_id,
      knowledge_writeback_ready: true,
    });
    expect(writebackReadyTasks.ok).toBe(true);
    expect(writebackReadyTasks.data?.map(item => item.task.task_id)).toEqual([taskId]);

    const queued = await updateProjectSupplementTask(enriched.project_id!, taskId, {
      status: 'resolved',
      knowledge_candidate_review_status: 'approved',
      knowledge_writeback_status: 'queued',
      knowledge_writeback_note: '已进入湖南知识库人工入库队列。',
    });
    expect(queued.ok).toBe(true);
    expect(queued.data?.current_story.supplement_tasks?.[0].knowledge_writeback_status).toBe('queued');
    expect(queued.data?.current_story.supplement_tasks?.[0].knowledge_writeback_note).toContain('人工入库队列');

    const queuedTasks = await listProjectSupplementTasks({
      project_id: enriched.project_id,
      video_type: 'ai_comic_drama',
      province: '湖南',
      knowledge_writeback_status: 'queued',
    });
    expect(queuedTasks.ok).toBe(true);
    expect(queuedTasks.data?.map(item => item.task.task_id)).toEqual([taskId]);
    expect(queuedTasks.data?.[0].target_province).toBe('湖南');
    expect(queuedTasks.data?.[0].suggested_file_path).toBe('data/provinces/湖南.md');

    const rawSource = JSON.parse(await readFile(storyPath, 'utf-8')) as StoryGenerateResult;
    expect(rawSource.production_material_readiness?.available_fields).toContain('reference_images_or_keyframes');
    expect(rawSource.supplement_tasks?.[0].knowledge_candidate_markdown).toContain('青石巷追问');
    expect(rawSource.supplement_tasks?.[0].knowledge_writeback_draft_markdown).toContain('正式知识库写入草案');
    expect(rawSource.quality_report?.production_material_readiness_report?.missing_risk_fields.some(field => (
      field.field_id === 'reference_images_or_keyframes'
    ))).toBe(false);

    const candidateExport = await exportProjectKnowledgeCandidates(enriched.project_id!);
    expect(candidateExport.ok).toBe(true);
    expect(candidateExport.data?.schema_version).toBe('project-knowledge-candidates/v1');
    expect(candidateExport.data?.candidate_count).toBe(1);
    expect(candidateExport.data?.markdown).toContain('青石巷追问 知识库候选稿');
    expect(candidateExport.data?.items[0].recommended_fields).toContain('reference_images_or_keyframes');
    expect(candidateExport.data?.items[0].review_status).toBe('approved');
    expect(candidateExport.data?.items[0].writeback_draft_markdown).toContain('正式知识库写入草案');
    expect(candidateExport.data?.items[0].writeback_status).toBe('queued');

    const writebackPatch = await exportProjectKnowledgeWritebackPatch(enriched.project_id!);
    expect(writebackPatch.ok).toBe(true);
    expect(writebackPatch.data?.schema_version).toBe('project-knowledge-writeback-patch/v1');
    expect(writebackPatch.data?.approved_count).toBe(1);
    expect(writebackPatch.data?.target_files).toContain('data/provinces/湖南.md');
    expect(writebackPatch.data?.pr_title).toContain('青石巷追问');
    expect(writebackPatch.data?.items[0].writeback_status).toBe('queued');
    expect(writebackPatch.data?.items[0].append_markdown).toContain('补录候选：参考图或关键帧');
    expect(writebackPatch.data?.items[0].append_markdown).toContain('核实方法');

    const queuePatch = await exportProjectKnowledgeWritebackQueuePatch({
      project_id: enriched.project_id,
      video_type: 'ai_comic_drama',
      province: '湖南',
      knowledge_writeback_status: 'queued',
    });
    expect(queuePatch.ok).toBe(true);
    expect(queuePatch.data?.schema_version).toBe('project-knowledge-writeback-patch/v1');
    expect(queuePatch.data?.approved_count).toBe(1);
    expect(queuePatch.data?.project_id).toBe(enriched.project_id);
    expect(queuePatch.data?.target_files).toContain('data/provinces/湖南.md');
    expect(queuePatch.data?.markdown).toContain('Story Agent 写回队列 Patch 草案');
    expect(queuePatch.data?.markdown).toContain('片型筛选：ai_comic_drama');
    expect(queuePatch.data?.markdown).toContain('省份筛选：湖南');
    expect(queuePatch.data?.markdown).toContain('写回状态：queued');
    expect(queuePatch.data?.items[0].project_id).toBe(enriched.project_id);
    expect(queuePatch.data?.items[0].video_type).toBe('ai_comic_drama');
    expect(queuePatch.data?.items[0].target_province).toBe('湖南');
    expect(queuePatch.data?.items[0].writeback_status).toBe('queued');
  });

  it('drafts AI comic production material fields from scenes through readiness automation', async () => {
    const productionPack = getProductionMaterialPack('ai_comic_drama');
    expect(productionPack).toBeTruthy();

    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const materialPack: StoryGenerateResult['material_pack'] = {
      schema_version: 'material-pack/v1',
      primary_materials: [{
        material_id: 'ai-comic-core-auto-draft',
        title: '青石巷 AI 漫剧自动草拟设定',
        summary: '第一格钩子、世界观、真实度、虚构、主角目标、对手压力、关系碰撞、场景锚点、角色稳定、服饰、发式、随身物、对白气泡、台词、情绪节拍、镜头提示词分层、基础设定、氛围、画质、画面内容、结尾钩子、禁用和待核实边界已整理。',
        source_type: 'manual_note',
        purpose: ['fact_basis', 'visual_asset', 'creative_boundary'],
        confidence: 0.72,
        tags: ['AI漫剧', '青石巷'],
      }],
      supporting_materials: [],
      reference_materials: [],
      visual_assets: [],
      verified_facts: ['虚构边界：本项目为 fictional_original，不声称为真实史实。'],
      uncertain_claims: ['图像生产基准待补。'],
      creative_space: ['可用漫画分镜方式表现青石巷追问。'],
      missing_needs: [],
      overall_confidence: 0.72,
    };
    const initialReadiness = buildProductionMaterialReadinessReport({
      productionMaterialPack: productionPack!,
      materialPack,
      contextText: 'AI漫剧，第一格钩子，世界观，主角目标，场景锚点，对白气泡，情绪节拍，结尾钩子，禁用边界。',
    });
    const targetFields = [
      'reference_images_or_keyframes',
      'identity_motion_consistency_plan',
      'single_shot_test',
      'multi_shot_continuity',
      'transition_plan',
    ];
    expect(initialReadiness?.missing_fields.map(field => field.field_id)).toEqual(expect.arrayContaining(targetFields));

    const fieldLabels: Record<string, string> = {
      reference_images_or_keyframes: '参考图或关键帧',
      identity_motion_consistency_plan: '身份动作一致性计划',
      single_shot_test: '单镜头测试',
      multi_shot_continuity: '多分镜连续性',
      transition_plan: '转场计划',
    };
    const baseStory = makeStory();
    const story: StoryGenerateResult = {
      ...baseStory,
      storyId: '20260609-story-ai-comic-autodraft',
      title: '青石巷追问',
      video_type: 'ai_comic_drama',
      presentation_style: 'ai_comic',
      source_entry: '青石巷漫剧自动草拟条目',
      material_pack: materialPack,
      production_material_pack: productionPack,
      production_material_readiness: initialReadiness,
      creation_use_case: 'original_ai_comic',
      truth_mode: 'fictional_original',
      scene_breakdown: baseStory.scene_breakdown.map(scene => ({
        ...scene,
        characters: scene.scene_id === 1 ? ['阿青', '巷口老人'] : ['阿青', '追问者'],
        visual_prompt: scene.scene_id === 1
          ? '雨后青石巷，阿青穿青绿色短袄，手握旧木牌回头，漫画分格，强表情'
          : '军衙堂前改为青石巷牌坊下，阿青与追问者对峙，木牌在右手，表情紧张',
        key_action: scene.scene_id === 1 ? '阿青回头护住木牌' : '阿青举起木牌当面质问',
        camera_suggestion: scene.scene_id === 1 ? '低机位轻微推进，木牌特写' : '中近景对切，保留对白气泡安全区',
        dialogue_or_narration: scene.scene_id === 1 ? '阿青：这块牌，为什么会刻我的名字？' : '追问者：你终于发现了。',
      })),
      gears_segments: baseStory.gears_segments.map(segment => ({
        ...segment,
        video_type: 'ai_comic_drama',
        presentation_style: 'ai_comic',
        visual_focus: segment.segment_id === 1
          ? ['雨后青石巷', '阿青青绿色短袄', '旧木牌特写']
          : ['牌坊下对峙', '对白气泡', '木牌右手位置'],
        segment_prompt_hint: segment.segment_id === 1
          ? 'comic drama panel, rain-wet stone alley, A Qing turns back with wooden tag'
          : 'comic drama panel, confrontation under stone arch, speech bubbles safe area',
      })),
      dialogue: [{
        scene_id: 1,
        lines: [{ character: '阿青', text: '这块牌，为什么会刻我的名字？', emotion: '惊疑' }],
      }, {
        scene_id: 2,
        lines: [{ character: '追问者', text: '你终于发现了。', emotion: '压迫' }],
      }],
      quality_report: {
        ...baseStory.quality_report!,
        video_type: 'ai_comic_drama',
        genre_score: 82,
      },
      supplement_tasks: targetFields.map(fieldId => ({
        task_id: `20260609-story-ai-comic-autodraft--production-template--${fieldId}`,
        need_id: `production_template_${fieldId}`,
        label: fieldLabels[fieldId],
        description: `补齐「AI漫剧」生产模板字段「${fieldLabels[fieldId]}」。`,
        stage: 'production_ready',
        blocking_level: fieldId === 'transition_plan' ? 'optional' : 'risk',
        affects: ['production_material_readiness', 'gears_delivery'],
        recommended_fields: [fieldId],
        recommended_question: `请补充${fieldLabels[fieldId]}。`,
        status: 'open',
        source: 'production_material_missing_field',
        created_at: '2026-06-09T10:00:00.000Z',
      })),
    };
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const storyDir = resolve(root, 'web', 'generated', 'stories', story.video_type);
    const storyPath = resolve(storyDir, `${story.storyId}.json`);
    await mkdir(storyDir, { recursive: true });
    await writeFile(storyPath, JSON.stringify({
      ...story,
      project_id: enriched.project_id,
      current_version_id: enriched.current_version_id,
      _request_meta: { created_at: '2026-06-09T10:00:00.000Z' },
    }, null, 2), 'utf-8');

    const beforeReadiness = await getProjectProductionReadiness(enriched.project_id!);
    expect(beforeReadiness.ok).toBe(true);
    expect(beforeReadiness.data?.next_actions.map(action => action.action_key))
      .toContain('draft_production_material_fields');
    expect(beforeReadiness.data?.automation_plan.steps.find(step => step.action_key === 'draft_production_material_fields'))
      .toMatchObject({
        runner: 'story_agent_api',
        mode: 'writes_project',
        can_auto_execute: true,
        api: {
          method: 'POST',
          path: `/api/projects/${enriched.project_id}/supplement-tasks/draft-production-material`,
        },
      });

    const automationRun = await runProjectProductionReadinessAutomation(enriched.project_id!, {
      dry_run: false,
      action_keys: ['draft_production_material_fields'],
    });
    expect(automationRun.ok).toBe(true);
    expect(automationRun.data?.executed_step_count).toBe(1);
    expect(automationRun.data?.steps[0]).toMatchObject({
      action_key: 'draft_production_material_fields',
      status: 'executed',
      response_schema_version: 'project-production-material-draft/v1',
    });
    expect(automationRun.data?.after_readiness.latest_automation_run?.steps[0].action_key)
      .toBe('draft_production_material_fields');
    expect(automationRun.data?.after_readiness.project.production_readiness_automation_ledger?.total_run_count)
      .toBe(1);

    const afterDetail = await getProject(enriched.project_id!);
    expect(afterDetail.ok).toBe(true);
    expect(afterDetail.data?.current_story.production_material_readiness?.status).toBe('ready');
    expect(afterDetail.data?.current_story.production_material_readiness?.missing_fields).toHaveLength(0);
    expect(afterDetail.data?.current_story.supplement_tasks?.every(task => task.status === 'resolved')).toBe(true);
    expect(afterDetail.data?.current_story.supplement_tasks?.[0].supplement_field_values?.reference_images_or_keyframes)
      .toContain('参考图或关键帧');
    expect(afterDetail.data?.current_story.material_pack?.supporting_materials.some(material => (
      material.tags?.includes('single_shot_test') && material.summary.includes('单镜头测试')
    ))).toBe(true);

    const rawSource = JSON.parse(await readFile(storyPath, 'utf-8')) as StoryGenerateResult;
    expect(rawSource.production_material_readiness?.status).toBe('ready');
    expect(rawSource.supplement_tasks?.map(task => task.status)).toEqual(targetFields.map(() => 'resolved'));
  });

  it('drafts core, explainer, and second-wave production material fields from scenes and delivery hints', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const cases: Array<{
      videoType: StoryGenerateResult['video_type'];
      style: StoryGenerateResult['presentation_style'];
      targetAudience: string;
      communicationGoal: string;
      fieldIds: string[];
      expectedSnippet: string;
      argumentPoints?: string[];
      knowledgeOutline?: string[];
      sourceQuotes?: string[];
      fieldNotes?: string[];
    }> = [
      {
        videoType: 'heritage_promo',
        style: 'documentary',
        targetAudience: '非遗宣传片观众',
        communicationGoal: '把工艺流程、手部动作、声音质感和当代连接拆成可拍素材。',
        fieldIds: [
          'project_name',
          'heritage_or_craft_type',
          'materials',
          'tools',
          'process_steps',
          'hand_actions',
          'documentation_assets',
          'visual_symbols',
          'sound_or_texture_details',
          'modern_connection',
          'production_risks',
        ],
        expectedSnippet: '流程步骤',
      },
      {
        videoType: 'documentary_short',
        style: 'documentary',
        targetAudience: '微纪录片观众',
        communicationGoal: '让观众通过现实入口、来源线索和当代痕迹理解文化条目。',
        fieldIds: [
          'documentary_question',
          'real_world_site_or_object',
          'source_quotes_or_source_cues',
          'timeline',
          'witness_or_expert_roles',
          'interview_clip_selection',
          'field_notes',
          'b_roll_plan',
          'reconstruction_boundary',
          'present_day_trace',
          'ambient_sound',
          'what_must_not_be_claimed',
        ],
        expectedSnippet: 'B-roll',
        sourceQuotes: ['馆方资料提示：该条目需要结合现场展陈理解。'],
        fieldNotes: ['现场观察：旧街入口可作为当代痕迹开场。'],
      },
      {
        videoType: 'explainer_video',
        style: 'host_narration',
        targetAudience: '零基础馆内观众',
        communicationGoal: '让观众用三层结构理解文化素材的事实、例子与边界。',
        fieldIds: [
          'core_question',
          'audience_level',
          'argument_points',
          'knowledge_outline',
          'concept_definitions',
          'knowledge_steps',
          'concrete_examples',
          'analogy_or_visual_metaphor',
          'diagram_or_caption_plan',
          'source_cues',
          'misconception_or_boundary',
          'recap_sentence',
        ],
        expectedSnippet: '知识层级',
        argumentPoints: ['先解释核心概念', '再用地点和道具举例', '最后标出事实边界'],
        knowledgeOutline: ['问题入口', '概念定义', '具体例子', '来源边界', '一句复盘'],
      },
      {
        videoType: 'children_story',
        style: 'children_animation',
        targetAudience: '7-9岁儿童',
        communicationGoal: '让孩子理解端午传说与事实边界。',
        fieldIds: ['audience_age_band', 'child_safe_conflict', 'protagonist_choice', 'emotional_resolution', 'parent_teacher_note'],
        expectedSnippet: '儿童',
      },
      {
        videoType: 'social_short',
        style: 'social_media_fastcut',
        targetAudience: '短视频观众',
        communicationGoal: '用竖屏短视频解释一件文化冷知识。',
        fieldIds: ['opening_hook', 'beat_interval', 'vertical_shot_plan', 'comment_prompt', 'fact_boundary_card'],
        expectedSnippet: '竖屏',
      },
      {
        videoType: 'lecture_video',
        style: 'host_narration',
        targetAudience: '基层宣讲受众',
        communicationGoal: '让观众理解历史选择背后的公共价值。',
        fieldIds: ['speaker_position', 'communication_goal', 'case_examples', 'slide_or_board_assets', 'audience_takeaway'],
        expectedSnippet: '主讲人',
      },
      {
        videoType: 'education_training',
        style: 'host_narration',
        targetAudience: '课堂学员',
        communicationGoal: '训练学员拆解文化素材的事实、例子与边界。',
        fieldIds: ['learning_objective', 'learner_profile', 'step_sequence', 'practice_task', 'assessment_check'],
        expectedSnippet: '学习目标',
      },
    ];

    for (const item of cases) {
      const productionPack = getProductionMaterialPack(item.videoType);
      expect(productionPack).toBeTruthy();
      const materialPack: StoryGenerateResult['material_pack'] = {
        schema_version: 'material-pack/v1',
        primary_materials: [],
        supporting_materials: [],
        reference_materials: [],
        visual_assets: [],
        verified_facts: ['已有来源线索：测试资料显示该素材与地方文化传播有关。'],
        uncertain_claims: ['人物关系、年代和传说流传范围待核实。'],
        creative_space: ['可从分镜中抽取讲解例子和镜头节奏。'],
        missing_needs: [],
        overall_confidence: 0.62,
      };
      const initialReadiness = buildProductionMaterialReadinessReport({
        productionMaterialPack: productionPack!,
        materialPack,
        contextText: '',
      });
      expect(initialReadiness?.missing_fields.length).toBeGreaterThan(0);

      const baseStory = makeStory();
      const story: StoryGenerateResult = {
        ...baseStory,
        storyId: `20260609-story-autodraft-${item.videoType}`,
        title: `${productionPack!.label}自动草拟测试`,
        video_type: item.videoType,
        presentation_style: item.style,
        source_entry: `${productionPack!.label}测试条目`,
        target_audience: item.targetAudience,
        communication_goal: item.communicationGoal,
        argument_points: item.argumentPoints,
        knowledge_outline: item.knowledgeOutline,
        source_quotes: item.sourceQuotes,
        field_notes: item.fieldNotes,
        material_pack: materialPack,
        production_material_pack: productionPack,
        production_material_readiness: initialReadiness,
        scene_breakdown: baseStory.scene_breakdown.map(scene => ({
          ...scene,
          title: `文化线索 ${scene.scene_id}`,
          location: scene.scene_id === 1 ? '旧街入口' : '展陈空间',
          visual_prompt: scene.scene_id === 1
            ? '竖屏近景，孩子或主讲人站在旧街入口，手指向文化符号，字幕安全区清晰'
            : '展陈空间中展示道具、地点卡和事实边界卡，讲述者用手势引导',
          key_action: scene.scene_id === 1 ? '主角发现一个文化符号并提出问题' : '讲述者用道具解释例子并提示待核实边界',
          dramatic_function: scene.scene_id === 1 ? '提出核心问题和前三秒钩子' : '给出具体例子并复盘',
          conflict: scene.scene_id === 1 ? '误会和好奇推动选择' : '事实、传说和改写之间需要分清',
          camera_suggestion: scene.scene_id === 1 ? '9:16 近景轻推，保留字幕区' : '中近景对切，切到道具特写',
          dialogue_or_narration: scene.scene_id === 1 ? '为什么这个符号会出现在这里？' : '我们只把有来源的部分当作事实。',
        })),
        gears_segments: baseStory.gears_segments.map(segment => ({
          ...segment,
          video_type: item.videoType,
          presentation_style: item.style,
          visual_focus: ['旧街入口', '文化符号', '字幕关键词', '事实边界卡'],
          segment_prompt_hint: '9:16 vertical shot, presenter or child notices cultural symbol, caption-safe composition',
        })),
        cultural_constraints: [
          '不得把传说和戏剧化表达写成已确认事实。',
          '待核实内容需保留来源线索和边界提示。',
        ],
        supplement_tasks: item.fieldIds.map(fieldId => ({
          task_id: `20260609-story-autodraft-${item.videoType}--production-template--${fieldId}`,
          need_id: `production_template_${fieldId}`,
          label: fieldId,
          description: `补齐「${productionPack!.label}」生产模板字段「${fieldId}」。`,
          stage: 'production_ready',
          blocking_level: 'risk',
          affects: ['production_material_readiness', 'gears_delivery'],
          recommended_fields: [fieldId],
          recommended_question: `请补充 ${fieldId}。`,
          status: 'open',
          source: 'production_material_missing_field',
          created_at: '2026-06-09T10:00:00.000Z',
        })),
      };
      const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
      const storyDir = resolve(root, 'web', 'generated', 'stories', story.video_type);
      const storyPath = resolve(storyDir, `${story.storyId}.json`);
      await mkdir(storyDir, { recursive: true });
      await writeFile(storyPath, JSON.stringify({
        ...story,
        project_id: enriched.project_id,
        current_version_id: enriched.current_version_id,
        _request_meta: { created_at: '2026-06-09T10:00:00.000Z' },
      }, null, 2), 'utf-8');

      const draftResult = await draftProjectProductionMaterialFields(enriched.project_id!);
      expect(draftResult.ok).toBe(true);
      expect(draftResult.data?.drafted_task_count).toBe(item.fieldIds.length);
      expect(draftResult.data?.drafted_field_count).toBe(item.fieldIds.length);
      expect(draftResult.data?.drafted_tasks.flatMap(task => task.field_ids))
        .toEqual(expect.arrayContaining(item.fieldIds));

      const afterDetail = await getProject(enriched.project_id!);
      expect(afterDetail.ok).toBe(true);
      expect(afterDetail.data?.current_story.supplement_tasks?.map(task => task.status))
        .toEqual(item.fieldIds.map(() => 'resolved'));
      const expectedAvailableFields = item.fieldIds.filter(fieldId => fieldId !== 'project_name');
      expect(afterDetail.data?.current_story.production_material_readiness?.available_fields)
        .toEqual(expect.arrayContaining(expectedAvailableFields));
      expect(JSON.stringify(afterDetail.data?.current_story.supplement_tasks?.map(task => task.supplement_field_values)))
        .toContain(item.expectedSnippet);
    }
  });

  it('adds manual project material and refreshes creation contract fields', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story: StoryGenerateResult = {
      ...makeStory(),
      material_pack: {
        schema_version: 'material-pack/v1',
        primary_materials: [],
        supporting_materials: [],
        reference_materials: [],
        visual_assets: [],
        verified_facts: [],
        uncertain_claims: ['地域背景待补'],
        creative_space: [],
        missing_needs: [{
          need_id: 'regional_context',
          label: '地域背景',
          message: '需要补充南安军衙的地域语境',
        }],
        overall_confidence: 0.45,
      },
    };
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const storyDir = resolve(root, 'web', 'generated', 'stories', story.video_type);
    const storyPath = resolve(storyDir, `${story.storyId}.json`);
    await mkdir(storyDir, { recursive: true });
    await writeFile(storyPath, JSON.stringify({
      ...story,
      project_id: enriched.project_id,
      current_version_id: enriched.current_version_id,
      _request_meta: { created_at: '2026-06-09T10:00:00.000Z' },
    }, null, 2), 'utf-8');

    const updated = await addProjectMaterialPackMaterial(enriched.project_id!, {
      target: 'primary_materials',
      title: '南安军衙主管',
      summary: '主管负责催促签署疑案文书，是权势压力的具体来源。',
      source_type: 'manual_note',
      purpose: ['character_source', 'fact_basis'],
      confidence: 0.82,
      tags: ['南安军衙', '疑案文书'],
      mark_as_verified_fact: true,
      remove_missing_need_id: 'regional_context',
    });

    expect(updated.ok).toBe(true);
    expect(updated.data?.current_story.material_pack?.primary_materials).toContainEqual(expect.objectContaining({
      title: '南安军衙主管',
      source_type: 'manual_note',
      purpose: ['character_source', 'fact_basis'],
      confidence: 0.82,
    }));
    expect(updated.data?.current_story.material_pack?.missing_needs).toEqual([]);
    expect(updated.data?.current_story.material_pack?.verified_facts.some(fact => fact.includes('疑案文书'))).toBe(true);
    expect(updated.data?.current_story.knowledge_pack?.primary_entries.some(entry => entry.summary.includes('权势压力'))).toBe(true);
    expect(updated.data?.current_story.material_sufficiency?.schema_version).toBe('material-sufficiency/v1');
    expect(updated.data?.current_story.creation_contract?.material_sufficiency.score).toBe(updated.data?.current_story.material_sufficiency?.score);
    expect(updated.data?.project.material_sufficiency?.score).toBe(updated.data?.current_story.material_sufficiency?.score);

    const snapshotPath = resolve(root, 'web', 'generated', 'projects', enriched.project_id!, 'versions', `${enriched.current_version_id}.json`);
    const snapshot = JSON.parse(await readFile(snapshotPath, 'utf-8')) as StoryProjectVersionSnapshot;
    expect(snapshot.story.material_pack?.primary_materials.some(material => material.title === '南安军衙主管')).toBe(true);
    expect(snapshot.story.creation_contract?.material_sufficiency.score).toBe(snapshot.story.material_sufficiency?.score);

    const rawSource = JSON.parse(await readFile(storyPath, 'utf-8')) as StoryGenerateResult;
    expect(rawSource.material_pack?.primary_materials.some(material => material.summary.includes('权势压力'))).toBe(true);
    expect(rawSource.material_sufficiency?.schema_version).toBe('material-sufficiency/v1');
  });

  it('builds a GEARS delivery package when reading old project snapshots', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');

    const detail = await getProject(enriched.project_id!);

    expect(detail.ok).toBe(true);
    expect(detail.data?.current_story.gears_delivery?.schema_version).toBe('gears-delivery/v1');
    expect(detail.data?.current_story.gears_delivery?.character_assets.some(character => character.name === '周敦颐')).toBe(true);
    expect(detail.data?.current_story.gears_delivery?.units.every(unit => unit.suggested_duration_sec <= 15)).toBe(true);
    expect(detail.data?.current_story.gears_delivery?.markdown).toContain('GEARS 供稿包');
  });

  it('deletes the project snapshots and source story file', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const projectId = enriched.project_id!;
    const storyDir = resolve(root, 'web', 'generated', 'stories', story.video_type);
    const storyPath = resolve(storyDir, `${story.storyId}.json`);
    const previousStoryId = '20260609-story-oldv';
    const previousStoryDir = resolve(root, 'web', 'generated', 'stories', 'ai_comic_drama');
    const previousStoryPath = resolve(previousStoryDir, `${previousStoryId}.json`);
    const projectPath = resolve(root, 'web', 'generated', 'projects', projectId);

    await mkdir(storyDir, { recursive: true });
    await writeFile(storyPath, JSON.stringify({
      ...story,
      project_id: projectId,
      current_version_id: enriched.current_version_id,
      _request_meta: { created_at: '2026-06-09T10:00:00.000Z' },
    }, null, 2), 'utf-8');
    await mkdir(previousStoryDir, { recursive: true });
    await writeFile(previousStoryPath, JSON.stringify({
      ...story,
      storyId: previousStoryId,
      video_type: 'ai_comic_drama',
      project_id: projectId,
    }, null, 2), 'utf-8');
    await writeFile(
      resolve(projectPath, 'versions', `${projectId}-v0.json`),
      JSON.stringify({
        project_id: projectId,
        version_id: `${projectId}-v0`,
        created_at: '2026-06-09T09:59:00.000Z',
        change_type: 'scene_regeneration',
        scene_ids_changed: [1],
        story: {
          ...story,
          storyId: previousStoryId,
          video_type: 'ai_comic_drama',
          project_id: projectId,
        },
      } satisfies StoryProjectVersionSnapshot, null, 2),
      'utf-8',
    );

    const deleted = await deleteProject(projectId);

    expect(deleted.ok).toBe(true);
    expect(deleted.data?.deleted).toBe(true);
    expect(deleted.data?.story_ids?.sort()).toEqual([previousStoryId, story.storyId].sort());
    expect(deleted.data?.removed_story_file_count).toBe(2);
    expect(await exists(storyPath)).toBe(false);
    expect(await exists(previousStoryPath)).toBe(false);
    expect(await exists(projectPath)).toBe(false);
    const detail = await getProject(projectId);
    expect(detail.ok).toBe(false);
  });

  it('batch deletes projects and reports missing ids', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const firstStory = makeStory();
    const secondStory: StoryGenerateResult = {
      ...makeStory(),
      storyId: '20260609-story-def2',
      title: '月岩悟道传说',
      gears_segments_url: '/api/stories/20260609-story-def2/gears-segments',
    };
    const first = await createProjectFromGeneratedStory(firstStory, '2026-06-09T10:00:00.000Z');
    const second = await createProjectFromGeneratedStory(secondStory, '2026-06-09T10:01:00.000Z');

    for (const story of [first, second]) {
      const storyDir = resolve(root, 'web', 'generated', 'stories', story.video_type);
      await mkdir(storyDir, { recursive: true });
      await writeFile(resolve(storyDir, `${story.storyId}.json`), JSON.stringify({
        ...story,
        _request_meta: { created_at: '2026-06-09T10:00:00.000Z' },
      }, null, 2), 'utf-8');
    }

    const result = await deleteProjects([
      first.project_id!,
      second.project_id!,
      '20260609-story-none--character_story',
    ]);

    expect(result.ok).toBe(true);
    expect(result.data?.deleted.map(item => item.project_id).sort()).toEqual([
      first.project_id!,
      second.project_id!,
    ].sort());
    expect(result.data?.failed).toHaveLength(1);
    expect(result.data?.failed[0].project_id).toBe('20260609-story-none--character_story');
    expect(await exists(resolve(root, 'web', 'generated', 'projects', first.project_id!))).toBe(false);
    expect(await exists(resolve(root, 'web', 'generated', 'projects', second.project_id!))).toBe(false);
    expect(await exists(resolve(root, 'web', 'generated', 'stories', first.video_type, `${first.storyId}.json`))).toBe(false);
    expect(await exists(resolve(root, 'web', 'generated', 'stories', second.video_type, `${second.storyId}.json`))).toBe(false);
  });

  it('retains the newest projects and deletes older stories', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const stories: StoryGenerateResult[] = [
      { ...makeStory(), storyId: '20260609-story-old1', title: '最早故事', gears_segments_url: '/api/stories/20260609-story-old1/gears-segments' },
      { ...makeStory(), storyId: '20260609-story-mid2', title: '中间故事', gears_segments_url: '/api/stories/20260609-story-mid2/gears-segments' },
      { ...makeStory(), storyId: '20260609-story-new3', title: '最新故事', gears_segments_url: '/api/stories/20260609-story-new3/gears-segments' },
    ];
    const createdStories: StoryGenerateResult[] = [];
    for (const [index, story] of stories.entries()) {
      const createdAt = `2026-06-09T10:0${index}:00.000Z`;
      const created = await createProjectFromGeneratedStory(story, createdAt);
      createdStories.push(created);
      const storyDir = resolve(root, 'web', 'generated', 'stories', story.video_type);
      await mkdir(storyDir, { recursive: true });
      await writeFile(resolve(storyDir, `${story.storyId}.json`), JSON.stringify({
        ...created,
        _request_meta: { created_at: createdAt },
      }, null, 2), 'utf-8');
    }
    const orphanProjectId = '20260609-story-orphan--character_story';
    await mkdir(resolve(root, 'web', 'generated', 'projects', orphanProjectId), { recursive: true });
    await writeFile(resolve(root, 'web', 'generated', 'projects', orphanProjectId, 'project.json'), JSON.stringify({
      project_id: orphanProjectId,
      current_story_id: '20260609-story-orphan',
      title: '孤立项目',
      source_domain: 'china_culture',
      source_entry: '缺失故事文件',
      video_type: 'character_story',
      presentation_style: 'cinematic',
      status: 'draft',
      created_at: '2026-06-09T10:09:00.000Z',
      updated_at: '2026-06-09T10:09:00.000Z',
      current_version_id: `${orphanProjectId}-v1`,
      version_count: 1,
      scene_count: 0,
      has_gears_segments: false,
      credibility_note: '测试',
      logline: '测试',
    }, null, 2), 'utf-8');

    const result = await retainRecentProjects(2);

    expect(result.ok).toBe(true);
    expect(result.data?.kept.map(project => project.project_id)).toEqual([
      createdStories[2].project_id,
      createdStories[1].project_id,
    ]);
    expect(result.data?.deleted.map(item => item.project_id).sort()).toEqual([
      createdStories[0].project_id,
      orphanProjectId,
    ].sort());
    expect(await exists(resolve(root, 'web', 'generated', 'projects', createdStories[0].project_id!))).toBe(false);
    expect(await exists(resolve(root, 'web', 'generated', 'projects', orphanProjectId))).toBe(false);
    expect(await exists(resolve(root, 'web', 'generated', 'stories', createdStories[0].video_type, `${createdStories[0].storyId}.json`))).toBe(false);
    expect(await exists(resolve(root, 'web', 'generated', 'projects', createdStories[1].project_id!))).toBe(true);
    expect(await exists(resolve(root, 'web', 'generated', 'projects', createdStories[2].project_id!))).toBe(true);
  });

  it('regenerates a single scene into a new version', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const projectId = buildProjectId(story.storyId, story.video_type);
    const currentVersionId = `${projectId}-v1`;
    const storyWithProject = {
      ...story,
      project_id: projectId,
      current_version_id: currentVersionId,
      _request_meta: { created_at: '2026-06-09T10:00:00.000Z' },
    };

    const storyDir = resolve(root, 'web', 'generated', 'stories', story.video_type);
    await mkdir(storyDir, { recursive: true });
    await writeFile(resolve(storyDir, `${story.storyId}.json`), JSON.stringify(storyWithProject, null, 2), 'utf-8');

    const result = await regenerateProjectScene(projectId, {
      scene_id: 1,
      intent: 'tighten_conflict',
      user_note: '突出他拒签后可能丢官的代价',
      model_profile_id: 'codex_gpt55',
    });

    expect(result.ok).toBe(true);
    expect(result.data?.project.version_count).toBe(2);
    expect(result.data?.project.current_version_id).toContain('-v2');
    expect(result.data?.current_story.scene_breakdown[0].plot).toContain('突出他拒签后可能丢官的代价');
    expect(result.data?.versions[0].change_type).toBe('scene_regeneration');
    expect(result.data?.project.model_profile_id).toBe('claude_sonnet');
    expect(result.data?.current_story.model_profile_id).toBe('claude_sonnet');
  });

  // ---------------------------------------------------------------------------
  // 旧故事兼容性测试：generation_mode/generation_used_fallback 缺失或为 false
  // ---------------------------------------------------------------------------

  it('fills generation_mode=local_only and generation_used_fallback=false for old stories missing these fields', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    // makeStory() 不含 generation_mode/generation_used_fallback → 模拟旧故事
    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');

    const detail = await getProject(enriched.project_id!);
    expect(detail.ok).toBe(true);
    // 旧故事缺失字段 → 填充为 local_only / false
    expect(detail.data?.current_story.generation_mode).toBe('local_only');
    expect(detail.data?.current_story.generation_used_fallback).toBe(false);
    expect(detail.data?.project.generation_mode).toBe('local_only');
    expect(detail.data?.project.generation_used_fallback).toBe(false);
  });

  it('preserves generation_used_fallback=false (does not coerce to undefined)', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    // 故事显式设置 generation_used_fallback=false（非旧故事缺失）
    const story = makeStory() as StoryGenerateResult & { generation_mode?: string; generation_used_fallback?: boolean };
    story.generation_mode = 'local_only';
    story.generation_used_fallback = false;

    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const detail = await getProject(enriched.project_id!);
    expect(detail.ok).toBe(true);
    // false 不应被 || 操作符吞掉变为 undefined
    expect(detail.data?.current_story.generation_used_fallback).toBe(false);
    expect(detail.data?.current_story.generation_mode).toBe('local_only');
  });

  it('preserves generation_mode=external_model and generation_used_fallback=true for adapter stories', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory() as StoryGenerateResult & { generation_mode?: string; generation_used_fallback?: boolean; generation_source?: string };
    story.generation_mode = 'external_model';
    story.generation_used_fallback = true;
    story.generation_source = 'Claude Sonnet (fallback)';

    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const detail = await getProject(enriched.project_id!);
    expect(detail.ok).toBe(true);
    expect(detail.data?.current_story.generation_mode).toBe('external_model');
    expect(detail.data?.current_story.generation_used_fallback).toBe(true);
    expect(detail.data?.current_story.generation_source).toBe('Claude Sonnet (fallback)');
  });
});
