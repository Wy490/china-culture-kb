// web/server/src/services/ai-comic-series-service.ts — AI comic series planning

import { dirname, resolve } from 'node:path';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { ErrorCodes, success, fail } from '@shared/types.js';
import type {
  AiComicContinuityLedger,
  AiComicContinuityLedgerEpisode,
  AiComicEpisodePlan,
  AiComicEpisodeGenerateRequest,
  AiComicPacingProfile,
  AiComicSeriesProjectDetail,
  AiComicSeriesProjectMeta,
  AiComicSeriesProjectSaveRequest,
  AiComicSeriesCharacterArc,
  AiComicSeriesPhase,
  AiComicSeriesPlan,
  AiComicSeriesPlanRequest,
  AiComicPlotThread,
  ApiResponse,
  KnowledgeNeed,
  KnowledgePack,
  StoryDetectedCharacter,
  StoryGenerateResult,
  SupportedDuration,
} from '@shared/types.js';
import { analyzeOutline, multiMatchEntries } from './outline-service.js';
import { generateAndStoreStory } from './story-service.js';

const PACING_LABELS: Record<AiComicPacingProfile, string> = {
  fast_hook: '强钩子快节奏',
  balanced_drama: '均衡剧情推进',
  slow_burn: '慢热铺陈',
  mystery_cliffhanger: '悬念钩子',
};

const PHASE_TEMPLATES = [
  { id: 'phase-1', purpose: '建立主角目标、世界规则和核心问题', turning_point: '主角被迫做出第一次选择' },
  { id: 'phase-2', purpose: '扩大人物关系和文化背景，让主线矛盾具体化', turning_point: '主角发现表面目标背后还有更深层原因' },
  { id: 'phase-3', purpose: '连续推进代价、误解和关键线索', turning_point: '长期线索汇合，主角失去原有依靠' },
  { id: 'phase-4', purpose: '集中处理反转、牺牲和价值选择', turning_point: '主角以新的信念重组行动方案' },
  { id: 'phase-5', purpose: '回收主要伏笔，完成主题表达并留下余味', turning_point: '主角完成最终选择，世界关系发生改变' },
];

type StoredAiComicSeriesProject = AiComicSeriesProjectDetail;

export async function generateAiComicSeriesPlan(
  request: AiComicSeriesPlanRequest,
): Promise<ApiResponse<AiComicSeriesPlan>> {
  const outline = request.outline.trim();
  if (!outline) {
    return fail(ErrorCodes.VALIDATION_ERROR, 'outline cannot be empty');
  }
  if (request.episode_duration_range_sec.min > request.episode_duration_range_sec.max) {
    return fail(ErrorCodes.INVALID_DURATION, 'episode_duration_range_sec.min cannot be greater than max');
  }

  const analysis = await analyzeOutline({
    outline,
    preferred_video_types: ['ai_comic_drama'],
  });
  const storyIntent = analysis.data?.story_intent;
  const detectedCharacters = mergeCharacters(
    request.character_hints ?? [],
    analysis.data?.detected_characters ?? [],
  );
  const knowledgeFocus = extractKnowledgeFocus(request.knowledge_pack, analysis.data?.detected_subjects ?? [], outline);
  const seriesTitle = request.series_title?.trim() || deriveSeriesTitle(outline, storyIntent?.main_character ?? null);
  const pacingProfile = request.pacing_profile ?? 'balanced_drama';
  const generationScope = request.generation_scope ?? 'full_planning';
  const phases = buildPhases(request.episode_count);
  const mainCharacters = buildCharacterArcs(detectedCharacters, request.episode_count, storyIntent?.main_character ?? null);
  const plotThreads = buildPlotThreads(request.episode_count, seriesTitle, knowledgeFocus, pacingProfile);
  const episodes = buildEpisodes({
    episodeCount: request.episode_count,
    durationMin: request.episode_duration_range_sec.min,
    durationMax: request.episode_duration_range_sec.max,
    phases,
    characters: mainCharacters,
    plotThreads,
    knowledgeFocus,
    outline,
    coreTheme: storyIntent?.core_theme ?? summarizeText(outline, 18),
    pacingProfile,
  });

  return success({
    schema_version: 'ai-comic-series-plan/v1',
    series_title: seriesTitle,
    episode_count: request.episode_count,
    episode_duration_range_sec: request.episode_duration_range_sec,
    pacing_profile: pacingProfile,
    generation_scope: generationScope,
    premise: outline,
    logline: buildLogline(seriesTitle, outline, storyIntent?.core_theme),
    core_theme: storyIntent?.core_theme ?? summarizeText(outline, 24),
    main_characters: mainCharacters,
    plot_threads: plotThreads,
    phases,
    episodes,
    continuity_rules: [
      {
        rule_id: 'rule-character-state',
        label: '角色状态递进',
        description: '每集只能在上一集状态上推进，不能让人物关系和动机回到未发生前。',
      },
      {
        rule_id: 'rule-open-threads',
        label: '线索开合记录',
        description: '新增线索必须在后续集数被延展、转向或回收，避免只提出不处理。',
      },
      {
        rule_id: 'rule-knowledge-boundary',
        label: '知识依据边界',
        description: '知识库明确内容作为事实依据，戏剧化补足内容需要保持可辨识的创作边界。',
      },
      {
        rule_id: 'rule-episode-memory',
        label: '单集记忆输入',
        description: '生成某一集分镜前，需要带入上一集结尾、当前阶段目标、未回收线索和角色当前状态。',
      },
    ],
    recurring_motifs: buildMotifs(knowledgeFocus, storyIntent?.target_emotion ?? []),
    production_notes: [
      `单集建议按 ${request.episode_duration_range_sec.min}-${request.episode_duration_range_sec.max} 秒规划，实际成片以分镜、对白密度和配音语速复核。`,
      '先审核系列规划，再逐集生成完整分镜；长系列不建议一次生成全部剧本文本。',
      '每集生成后应更新连续性状态，再进入下一集，保持人物选择、线索和情绪曲线前后相连。',
    ],
  });
}

export async function generateAiComicEpisodeFromPlan(
  request: AiComicEpisodeGenerateRequest,
): Promise<ApiResponse<StoryGenerateResult>> {
  const existingProject = request.series_project_id
    ? await readSeriesProject(request.series_project_id)
    : null;
  if (request.series_project_id && !existingProject) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${request.series_project_id}" not found`);
  }
  const continuityLedger = existingProject?.continuity_ledger;
  const plan = request.series_plan;
  const episode = plan.episodes.find(item => item.episode_no === request.episode_no);
  if (!episode) {
    return fail(ErrorCodes.VALIDATION_ERROR, `episode_no ${request.episode_no} does not exist in series_plan`);
  }

  const knowledgePack = request.knowledge_pack ?? await buildKnowledgePackForSeries(plan);
  if (knowledgePack.primary_entries.length === 0) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      'No primary knowledge entry was found for this series. Add a knowledge_pack before generating an episode.',
    );
  }

  const episodeOutline = buildEpisodeGenerationOutline(plan, episode, continuityLedger);
  return generateAndStoreStory({
    video_type: 'ai_comic_drama',
    presentation_style: 'ai_comic',
    story_structure: 'single_event_drama',
    selected_event: episode.title,
    target_video_duration: closestSupportedDuration(episode.target_duration_sec),
    original_user_query: episodeOutline,
    outline: episodeOutline,
    tone: `连续漫剧第${episode.episode_no}集，保持人物状态、线索开合和结尾钩子前后一致。`,
    output_gears_segments: request.output_gears_segments ?? true,
    model_profile_id: request.model_profile_id,
    knowledge_pack: knowledgePack,
    character_hints: buildEpisodeCharacterHints(plan, episode),
  }).then(async result => {
    if (result.ok && result.data && request.series_project_id) {
      await recordGeneratedEpisodeStory({
        seriesProjectId: request.series_project_id,
        plan,
        episode,
        story: result.data,
      });
    }
    return result;
  });
}

export async function saveAiComicSeriesProject(
  request: AiComicSeriesProjectSaveRequest,
): Promise<ApiResponse<AiComicSeriesProjectDetail>> {
  const now = new Date().toISOString();
  const seriesProjectId = request.series_project_id ?? generateSeriesProjectId();
  const existing = request.series_project_id ? await readSeriesProject(seriesProjectId) : null;
  const generatedEpisodeStoryIds = {
    ...(existing?.generated_episode_story_ids ?? {}),
    ...(request.generated_episode_story_ids ?? {}),
  };
  const continuityLedger = request.continuity_ledger
    ?? existing?.continuity_ledger
    ?? buildInitialContinuityLedger(request.plan);

  const detail: AiComicSeriesProjectDetail = {
    project: buildSeriesProjectMeta({
      seriesProjectId,
      plan: request.plan,
      createdAt: existing?.project.created_at ?? now,
      updatedAt: now,
      generatedEpisodeStoryIds,
    }),
    plan: request.plan,
    generated_episode_story_ids: generatedEpisodeStoryIds,
    continuity_ledger: continuityLedger,
  };

  await writeJsonFile(seriesProjectPath(seriesProjectId), detail);
  return success(detail);
}

export async function getAiComicSeriesProject(
  seriesProjectId: string,
): Promise<ApiResponse<AiComicSeriesProjectDetail>> {
  const detail = await readSeriesProject(seriesProjectId);
  if (!detail) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }
  return success(detail);
}

export async function listAiComicSeriesProjects(): Promise<ApiResponse<AiComicSeriesProjectMeta[]>> {
  let projectIds: string[];
  try {
    projectIds = await readdir(seriesProjectsRoot());
  } catch {
    return success([]);
  }

  const projects: AiComicSeriesProjectMeta[] = [];
  for (const projectId of projectIds) {
    const detail = await readSeriesProject(projectId);
    if (detail) projects.push(detail.project);
  }

  projects.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return success(projects);
}

async function recordGeneratedEpisodeStory(
  params: {
    seriesProjectId: string;
    plan: AiComicSeriesPlan;
    episode: AiComicEpisodePlan;
    story: StoryGenerateResult;
  },
): Promise<void> {
  const existing = await readSeriesProject(params.seriesProjectId);
  if (!existing) return;
  const generatedEpisodeStoryIds = {
    ...existing.generated_episode_story_ids,
    [String(params.episode.episode_no)]: params.story.storyId,
  };
  const continuityLedger = updateContinuityLedger({
    ledger: existing.continuity_ledger ?? buildInitialContinuityLedger(params.plan),
    plan: params.plan,
    episode: params.episode,
    story: params.story,
  });
  const now = new Date().toISOString();
  const detail: AiComicSeriesProjectDetail = {
    ...existing,
    project: buildSeriesProjectMeta({
      seriesProjectId: params.seriesProjectId,
      plan: existing.plan,
      createdAt: existing.project.created_at,
      updatedAt: now,
      generatedEpisodeStoryIds,
    }),
    generated_episode_story_ids: generatedEpisodeStoryIds,
    continuity_ledger: continuityLedger,
  };
  await writeJsonFile(seriesProjectPath(params.seriesProjectId), detail);
}

function kbRoot(): string {
  return process.env.KB_ROOT || resolve(import.meta.dirname, '..', '..', '..', 'data');
}

function seriesProjectsRoot(): string {
  return resolve(kbRoot(), '..', 'web', 'generated', 'ai-comic-series-projects');
}

function seriesProjectPath(seriesProjectId: string): string {
  return resolve(seriesProjectsRoot(), seriesProjectId, 'project.json');
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf-8')) as T;
}

async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

async function readSeriesProject(seriesProjectId: string): Promise<StoredAiComicSeriesProject | null> {
  const filePath = seriesProjectPath(seriesProjectId);
  if (!(await pathExists(filePath))) return null;
  const detail = await readJsonFile<StoredAiComicSeriesProject>(filePath);
  return {
    ...detail,
    continuity_ledger: detail.continuity_ledger ?? buildInitialContinuityLedger(detail.plan),
  };
}

function generateSeriesProjectId(): string {
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const hash = Math.random().toString(36).slice(2, 10);
  return `${ymd}-series-${hash}`;
}

function buildSeriesProjectMeta(params: {
  seriesProjectId: string;
  plan: AiComicSeriesPlan;
  createdAt: string;
  updatedAt: string;
  generatedEpisodeStoryIds: Record<string, string>;
}): AiComicSeriesProjectMeta {
  return {
    series_project_id: params.seriesProjectId,
    title: params.plan.series_title,
    episode_count: params.plan.episode_count,
    episode_duration_range_sec: params.plan.episode_duration_range_sec,
    pacing_profile: params.plan.pacing_profile,
    logline: params.plan.logline,
    created_at: params.createdAt,
    updated_at: params.updatedAt,
    generated_episode_count: Object.keys(params.generatedEpisodeStoryIds).length,
  };
}

function buildInitialContinuityLedger(plan: AiComicSeriesPlan): AiComicContinuityLedger {
  return {
    schema_version: 'ai-comic-continuity-ledger/v1',
    character_state_current: plan.main_characters.map(character =>
      `${character.name}：${character.starting_state}`,
    ),
    open_threads: plan.plot_threads
      .filter(thread => thread.setup_episode === 1)
      .map(thread => `${thread.title}：${thread.description}`),
    paid_off_threads: [],
    knowledge_used: [],
    episode_records: [],
  };
}

function updateContinuityLedger(params: {
  ledger: AiComicContinuityLedger;
  plan: AiComicSeriesPlan;
  episode: AiComicEpisodePlan;
  story: StoryGenerateResult;
}): AiComicContinuityLedger {
  const openedThreads = params.plan.plot_threads
    .filter(thread => thread.setup_episode === params.episode.episode_no)
    .map(thread => `${thread.title}：${thread.description}`);
  const paidOffThreads = [
    ...params.plan.plot_threads
      .filter(thread => thread.payoff_episode === params.episode.episode_no)
      .map(thread => `${thread.title}：${thread.description}`),
    ...params.episode.payoff,
  ];
  const pendingThreadsAfter = unique([
    ...params.ledger.open_threads,
    ...openedThreads,
    ...params.episode.foreshadowing,
  ]).filter(thread => !paidOffThreads.some(paid => sameThread(thread, paid)));
  const knowledgeUsed = unique([
    ...params.ledger.knowledge_used,
    ...params.episode.knowledge_focus,
    ...(params.story.knowledge_pack?.primary_entries ?? []).map(entry => entry.entry_name),
    ...(params.story.knowledge_pack?.supporting_entries ?? []).map(entry => entry.entry_name),
  ]);
  const record: AiComicContinuityLedgerEpisode = {
    episode_no: params.episode.episode_no,
    story_id: params.story.storyId,
    title: params.episode.title,
    generated_at: new Date().toISOString(),
    character_state: params.episode.continuity_state_after,
    opened_threads: openedThreads,
    paid_off_threads: paidOffThreads,
    pending_threads_after: pendingThreadsAfter,
    knowledge_used: params.episode.knowledge_focus,
    ending_hook: params.episode.ending_hook,
    next_episode_memory: [
      `第${params.episode.episode_no}集结尾：${params.episode.ending_hook}`,
      ...params.episode.continuity_state_after,
      ...pendingThreadsAfter.slice(0, 4).map(thread => `未回收：${thread}`),
    ],
  };
  const records = [
    ...params.ledger.episode_records.filter(item => item.episode_no !== params.episode.episode_no),
    record,
  ].sort((a, b) => a.episode_no - b.episode_no);

  return {
    schema_version: 'ai-comic-continuity-ledger/v1',
    last_generated_episode_no: Math.max(
      params.episode.episode_no,
      params.ledger.last_generated_episode_no ?? 0,
    ),
    character_state_current: params.episode.continuity_state_after,
    open_threads: pendingThreadsAfter,
    paid_off_threads: unique([...params.ledger.paid_off_threads, ...paidOffThreads]),
    knowledge_used: knowledgeUsed,
    episode_records: records,
  };
}

function sameThread(left: string, right: string): boolean {
  const leftTitle = left.split(/[：:]/)[0] ?? left;
  const rightTitle = right.split(/[：:]/)[0] ?? right;
  return leftTitle === rightTitle || left.includes(rightTitle) || right.includes(leftTitle);
}

async function buildKnowledgePackForSeries(plan: AiComicSeriesPlan): Promise<KnowledgePack> {
  const analysis = await analyzeOutline({
    outline: plan.premise,
    preferred_video_types: ['ai_comic_drama'],
  });
  if (!analysis.ok || !analysis.data) {
    return {
      primary_entries: [],
      supporting_entries: [],
      missing_needs: [{
        need_id: 'series_knowledge',
        label: '系列知识依据',
        message: analysis.error?.message ?? '系列梗概未能分析出知识依据',
      }],
      overall_confidence: 0,
    };
  }

  const needs = analysis.data.knowledge_needs.length > 0
    ? analysis.data.knowledge_needs
    : buildFallbackKnowledgeNeeds(plan, analysis.data.detected_subjects);
  const match = await multiMatchEntries({
    outline: plan.premise,
    knowledge_needs: needs,
    limit_per_need: 5,
  });
  if (!match.ok || !match.data) {
    return {
      primary_entries: [],
      supporting_entries: [],
      missing_needs: [{
        need_id: 'series_knowledge',
        label: '系列知识依据',
        message: match.error?.message ?? '系列知识依据匹配失败',
      }],
      overall_confidence: 0,
    };
  }
  return match.data.matched_knowledge_pack;
}

function buildFallbackKnowledgeNeeds(plan: AiComicSeriesPlan, detectedSubjects: string[]): KnowledgeNeed[] {
  const keywords = unique([
    ...detectedSubjects,
    ...plan.main_characters.map(character => character.name),
    ...plan.episodes.flatMap(episode => episode.knowledge_focus),
  ].filter(Boolean)).slice(0, 8);
  return [{
    need_id: 'series_knowledge',
    label: '系列知识依据',
    keywords: keywords.length > 0 ? keywords : [plan.series_title],
    required: true,
  }];
}

function buildEpisodeGenerationOutline(
  plan: AiComicSeriesPlan,
  episode: AiComicEpisodePlan,
  ledger?: AiComicContinuityLedger,
): string {
  const previous = plan.episodes.find(item => item.episode_no === episode.episode_no - 1);
  const next = plan.episodes.find(item => item.episode_no === episode.episode_no + 1);
  const phase = plan.phases.find(item =>
    episode.episode_no >= item.episode_range[0] && episode.episode_no <= item.episode_range[1]
  );
  const previousLedgerRecord = ledger?.episode_records
    .filter(record => record.episode_no < episode.episode_no)
    .sort((a, b) => b.episode_no - a.episode_no)[0];
  const ledgerLines = ledger ? [
    '连续性账本：后续分镜必须以账本为准，不得推翻已生成集数的人物状态、线索开合和知识使用记录。',
    `账本最近生成集：${ledger.last_generated_episode_no ? `第${ledger.last_generated_episode_no}集` : '尚未生成'}`,
    `账本当前角色状态：${ledger.character_state_current.join('；') || '暂无'}`,
    `账本未回收线索：${ledger.open_threads.join('；') || '暂无'}`,
    `账本已回收线索：${ledger.paid_off_threads.join('；') || '暂无'}`,
    `账本已用知识：${ledger.knowledge_used.join('、') || '暂无'}`,
    previousLedgerRecord
      ? `上一条生成记忆：第${previousLedgerRecord.episode_no}集《${previousLedgerRecord.title}》；故事ID：${previousLedgerRecord.story_id}；${previousLedgerRecord.next_episode_memory.join('；')}`
      : '',
  ] : [];

  return [
    `系列名：${plan.series_title}`,
    `只生成第${episode.episode_no}集完整分镜，不生成其他集。`,
    `系列梗概：${plan.premise}`,
    `系列主题：${plan.core_theme}`,
    `本集标题：${episode.title}`,
    `本集目标：${episode.target_duration_sec}秒左右，约${episode.target_panel_count}格。该时长是生成前目标，不代表最终成片真实时长。`,
    `本集阶段：${episode.story_phase}`,
    phase ? `阶段目标：${phase.purpose}；阶段转折：${phase.turning_point}` : '',
    `本集主冲突：${episode.main_conflict}`,
    `关键角色：${episode.key_characters.join('、') || plan.main_characters.map(character => character.name).join('、')}`,
    `承接上一集：${episode.continuity_from_previous.join('；')}`,
    previous ? `上一集结尾钩子：${previous.ending_hook}` : '',
    `本集新增信息：${episode.new_information.join('；')}`,
    `本集伏笔：${episode.foreshadowing.join('；') || '无'}`,
    `本集回收：${episode.payoff.join('；') || '无'}`,
    `本集结尾钩子：${episode.ending_hook}`,
    `本集后连续性状态：${episode.continuity_state_after.join('；')}`,
    next ? `下一集需要承接：${next.main_conflict}；${next.continuity_from_previous.join('；')}` : '',
    ...ledgerLines,
    `长期线索：${plan.plot_threads.map(thread => `${thread.title}，第${thread.setup_episode}集开启，第${thread.payoff_episode}集回收：${thread.description}`).join('；')}`,
    `角色弧线：${plan.main_characters.map(character => `${character.name}：${character.long_arc}`).join('；')}`,
    `连续性规则：${plan.continuity_rules.map(rule => `${rule.label}：${rule.description}`).join('；')}`,
    `知识焦点：${episode.knowledge_focus.join('、') || plan.recurring_motifs.join('、')}`,
    '输出要求：按 AI 漫剧分镜生成完整故事文本、场景分解、对白、画面提示和 GEARS 分段；必须回应上一集钩子，并让本集结尾钩子可被下一集承接。',
  ].filter(Boolean).join('\n');
}

function closestSupportedDuration(seconds: number): SupportedDuration {
  const options: Array<{ value: SupportedDuration; seconds: number }> = [
    { value: '30秒', seconds: 30 },
    { value: '1分钟', seconds: 60 },
    { value: '3分钟', seconds: 180 },
    { value: '5分钟', seconds: 300 },
    { value: '8分钟', seconds: 480 },
    { value: '10分钟', seconds: 600 },
    { value: '15分钟', seconds: 900 },
    { value: '20分钟', seconds: 1200 },
  ];
  return options.reduce((best, option) =>
    Math.abs(option.seconds - seconds) < Math.abs(best.seconds - seconds) ? option : best
  ).value;
}

function buildEpisodeCharacterHints(plan: AiComicSeriesPlan, episode: AiComicEpisodePlan): StoryDetectedCharacter[] {
  const names = unique([
    ...episode.key_characters,
    ...plan.main_characters.slice(0, 3).map(character => character.name),
  ].filter(Boolean));

  return names.map((name, index) => ({
    name,
    role_position: index === 0 ? '主角' : '配角',
    character_kind: 'named_person',
    source_text: `漫剧系列《${plan.series_title}》第${episode.episode_no}集角色`,
    asset_stability: 'recurring',
  }));
}

function mergeCharacters(primary: StoryDetectedCharacter[], secondary: StoryDetectedCharacter[]): StoryDetectedCharacter[] {
  const map = new Map<string, StoryDetectedCharacter>();
  for (const character of [...primary, ...secondary]) {
    if (!map.has(character.name)) {
      map.set(character.name, character);
    }
  }
  return [...map.values()];
}

function deriveSeriesTitle(outline: string, mainCharacter: string | null): string {
  if (mainCharacter) return `${mainCharacter}漫剧系列`;
  const titleSeed = summarizeText(outline, 12).replace(/[，。；：！？\s]/g, '');
  return `${titleSeed || 'AI漫剧'}系列`;
}

function buildLogline(seriesTitle: string, outline: string, coreTheme?: string): string {
  const theme = coreTheme || summarizeText(outline, 18);
  return `${seriesTitle}围绕“${theme}”展开，用连续短集推进人物选择、文化线索和情绪回收。`;
}

function buildPhases(episodeCount: number): AiComicSeriesPhase[] {
  const phaseCount = episodeCount <= 1 ? 1 : episodeCount <= 6 ? 3 : episodeCount <= 20 ? 4 : 5;
  const phases: AiComicSeriesPhase[] = [];
  let start = 1;
  for (let index = 0; index < phaseCount; index += 1) {
    const remainingEpisodes = episodeCount - start + 1;
    const remainingPhases = phaseCount - index;
    const length = Math.ceil(remainingEpisodes / remainingPhases);
    const end = Math.min(episodeCount, start + length - 1);
    const template = PHASE_TEMPLATES[index];
    phases.push({
      phase_id: template.id,
      episode_range: [start, end],
      purpose: template.purpose,
      turning_point: template.turning_point,
    });
    start = end + 1;
  }
  return phases;
}

function buildCharacterArcs(
  detectedCharacters: StoryDetectedCharacter[],
  episodeCount: number,
  mainCharacter: string | null,
): AiComicSeriesCharacterArc[] {
  const baseNames = detectedCharacters.map(character => character.name);
  const names = unique([
    mainCharacter,
    ...baseNames,
    baseNames.length === 0 ? '主角' : null,
    '关键见证者',
    '对照角色',
  ].filter(Boolean) as string[]).slice(0, 5);

  return names.map((name, index) => {
    const isLead = index === 0;
    const role = isLead ? '主角' : index === 1 ? '重要配角' : index === 2 ? '关系推动者' : '功能角色';
    return {
      name,
      role,
      starting_state: isLead ? '带着未完成目标进入故事' : '掌握一部分信息或情绪立场',
      desire: isLead ? '找到能回应核心主题的行动答案' : '推动主角面对新的选择',
      long_arc: isLead ? '从被问题推着走，到主动承担选择后果' : '从单一立场变成主线变化的见证与推动力量',
      turning_points: buildTurningPoints(episodeCount, isLead),
      visual_signature: isLead ? `${name}的固定服饰、随身物或动作习惯` : `${name}的识别道具和表情基调`,
    };
  });
}

function buildTurningPoints(episodeCount: number, isLead: boolean): Array<{ episode_no: number; change: string }> {
  const points = unique([
    1,
    Math.max(1, Math.ceil(episodeCount * 0.34)),
    Math.max(1, Math.ceil(episodeCount * 0.68)),
    episodeCount,
  ]);
  return points.map((episodeNo, index) => ({
    episode_no: episodeNo,
    change: isLead
      ? ['目标被点燃', '第一次付出代价', '重建信念', '完成最终选择'][index] ?? '状态推进'
      : ['进入主线', '立场变化', '提供关键推动', '关系落点'][index] ?? '关系推进',
  }));
}

function buildPlotThreads(
  episodeCount: number,
  seriesTitle: string,
  knowledgeFocus: string[],
  pacingProfile: AiComicPacingProfile,
): AiComicPlotThread[] {
  const late = Math.max(1, episodeCount);
  const mid = Math.max(1, Math.ceil(episodeCount * 0.55));
  const earlyPayoff = Math.max(1, Math.ceil(episodeCount * 0.28));
  return [
    {
      thread_id: 'thread-main',
      title: `${seriesTitle}主线`,
      setup_episode: 1,
      payoff_episode: late,
      description: '主角围绕核心问题持续做选择，并在终局完成主题表达。',
      continuity_notes: ['每集必须推动主线状态', '主角选择带来的代价要进入后续集'],
    },
    {
      thread_id: 'thread-knowledge',
      title: knowledgeFocus[0] ? `${knowledgeFocus[0]}知识线` : '文化知识线',
      setup_episode: 1,
      payoff_episode: mid,
      description: '把知识依据拆成可视化线索，在剧情推进中逐步揭示。',
      continuity_notes: ['知识信息要服务人物行动', '新信息出现后需要改变角色判断'],
    },
    {
      thread_id: 'thread-emotion',
      title: `${PACING_LABELS[pacingProfile]}情绪线`,
      setup_episode: Math.min(2, late),
      payoff_episode: Math.max(earlyPayoff, Math.min(late, earlyPayoff + 1)),
      description: '通过短集结尾钩子和情绪反差保持追看动力。',
      continuity_notes: ['结尾钩子应在下一集开头回应', '情绪强点需要阶段性降落'],
    },
  ];
}

function buildEpisodes(params: {
  episodeCount: number;
  durationMin: number;
  durationMax: number;
  phases: AiComicSeriesPhase[];
  characters: AiComicSeriesCharacterArc[];
  plotThreads: AiComicPlotThread[];
  knowledgeFocus: string[];
  outline: string;
  coreTheme: string;
  pacingProfile: AiComicPacingProfile;
}): AiComicEpisodePlan[] {
  const episodes: AiComicEpisodePlan[] = [];
  for (let episodeNo = 1; episodeNo <= params.episodeCount; episodeNo += 1) {
    const phase = findPhase(params.phases, episodeNo);
    const previous = episodes[episodes.length - 1];
    const duration = chooseDuration(episodeNo, params.episodeCount, params.durationMin, params.durationMax, params.pacingProfile);
    const threadPayoffs = params.plotThreads.filter(thread => thread.payoff_episode === episodeNo);
    const threadSetups = params.plotThreads.filter(thread => thread.setup_episode === episodeNo);
    const focus = chooseKnowledgeFocus(params.knowledgeFocus, episodeNo);
    const keyCharacters = chooseKeyCharacters(params.characters, episodeNo);

    episodes.push({
      episode_no: episodeNo,
      title: buildEpisodeTitle(episodeNo, params.episodeCount, phase, params.coreTheme),
      target_duration_sec: duration,
      target_panel_count: Math.max(4, Math.min(60, Math.round(duration / 6))),
      story_phase: `${phase.phase_id}：${phase.purpose}`,
      main_conflict: buildConflict(episodeNo, params.episodeCount, params.coreTheme, focus),
      key_characters: keyCharacters,
      continuity_from_previous: episodeNo === 1
        ? ['建立主角初始状态、核心问题和第一条长期线索']
        : [
            `承接第${episodeNo - 1}集结尾：${previous?.ending_hook ?? '上一集留下的选择'}`,
            `延续第${episodeNo - 1}集后的状态：${previous?.continuity_state_after[0] ?? '人物关系继续变化'}`,
          ],
      new_information: [
        focus ? `新增知识焦点：${focus}` : `新增剧情信息：${summarizeText(params.outline, 16)}`,
        threadSetups.length > 0 ? `开启线索：${threadSetups.map(thread => thread.title).join('、')}` : `推进${phase.phase_id}的阶段目标`,
      ],
      foreshadowing: buildForeshadowing(episodeNo, params.episodeCount, params.plotThreads, focus),
      payoff: threadPayoffs.length > 0
        ? threadPayoffs.map(thread => `回收${thread.title}：${thread.description}`)
        : episodeNo % 5 === 0
          ? [`阶段性回应第${Math.max(1, episodeNo - 3)}集留下的疑问`]
          : [],
      ending_hook: buildEndingHook(episodeNo, params.episodeCount, params.pacingProfile, focus),
      knowledge_focus: focus ? [focus] : params.knowledgeFocus.slice(0, 2),
      continuity_state_after: [
        `第${episodeNo}集后，${keyCharacters[0] ?? '主角'}对“${params.coreTheme}”的理解推进一层`,
        episodeNo === params.episodeCount ? '主要长期线索完成回收' : `保留第${episodeNo + 1}集需要回应的选择或疑问`,
      ],
    });
  }
  return episodes;
}

function findPhase(phases: AiComicSeriesPhase[], episodeNo: number): AiComicSeriesPhase {
  return phases.find(phase => episodeNo >= phase.episode_range[0] && episodeNo <= phase.episode_range[1]) ?? phases[0];
}

function chooseDuration(
  episodeNo: number,
  episodeCount: number,
  min: number,
  max: number,
  pacingProfile: AiComicPacingProfile,
): number {
  if (min === max) return min;
  const range = max - min;
  const progress = episodeCount <= 1 ? 1 : (episodeNo - 1) / (episodeCount - 1);
  const curve = pacingProfile === 'fast_hook'
    ? (episodeNo <= 3 ? 0.35 : 0.58)
    : pacingProfile === 'slow_burn'
      ? 0.35 + progress * 0.45
      : pacingProfile === 'mystery_cliffhanger'
        ? (episodeNo % 3 === 0 ? 0.82 : 0.52)
        : 0.5 + Math.sin(progress * Math.PI) * 0.25;
  return Math.round(min + range * Math.min(1, Math.max(0, curve)));
}

function chooseKnowledgeFocus(focus: string[], episodeNo: number): string {
  if (focus.length === 0) return '';
  return focus[(episodeNo - 1) % focus.length];
}

function chooseKeyCharacters(characters: AiComicSeriesCharacterArc[], episodeNo: number): string[] {
  const lead = characters[0]?.name;
  const rotating = characters.length > 1 ? characters[((episodeNo - 1) % (characters.length - 1)) + 1]?.name : undefined;
  return unique([lead, rotating].filter(Boolean) as string[]);
}

function buildEpisodeTitle(episodeNo: number, episodeCount: number, phase: AiComicSeriesPhase, coreTheme: string): string {
  if (episodeNo === 1) return `第1集：问题出现`;
  if (episodeNo === episodeCount) return `第${episodeNo}集：最终选择`;
  if (episodeNo === phase.episode_range[1]) return `第${episodeNo}集：${phase.turning_point}`;
  return `第${episodeNo}集：${summarizeText(coreTheme, 8)}的新变化`;
}

function buildConflict(episodeNo: number, episodeCount: number, coreTheme: string, focus: string): string {
  if (episodeNo === 1) return `主角第一次面对“${coreTheme}”带来的选择。`;
  if (episodeNo === episodeCount) return `主角必须用最终行动回答“${coreTheme}”。`;
  return focus
    ? `围绕${focus}的新信息，让主角原有判断出现偏差。`
    : `新的阻力让主角对“${coreTheme}”产生更具体的判断。`;
}

function buildForeshadowing(
  episodeNo: number,
  episodeCount: number,
  plotThreads: AiComicPlotThread[],
  focus: string,
): string[] {
  if (episodeNo >= episodeCount) return [];
  const futureThread = plotThreads.find(thread => thread.setup_episode <= episodeNo && thread.payoff_episode > episodeNo);
  const target = futureThread ? `第${futureThread.payoff_episode}集的${futureThread.title}` : `第${episodeNo + 1}集的选择`;
  return [focus ? `${focus}中出现一个未解释细节，指向${target}` : `留出一个未解释细节，指向${target}`];
}

function buildEndingHook(
  episodeNo: number,
  episodeCount: number,
  pacingProfile: AiComicPacingProfile,
  focus: string,
): string {
  if (episodeNo === episodeCount) return '主角完成选择，但留下可延展的情绪余波。';
  if (pacingProfile === 'mystery_cliffhanger') {
    return focus ? `${focus}出现反常细节，下一集必须解释。` : '关键细节突然改变，下一集必须解释。';
  }
  if (pacingProfile === 'fast_hook') {
    return '主角刚做出选择，立刻迎来更高代价。';
  }
  if (pacingProfile === 'slow_burn') {
    return '一个细小变化被保留下来，下一集继续发酵。';
  }
  return '主角得到新信息，也失去一种原本确定的判断。';
}

function extractKnowledgeFocus(knowledgePack: KnowledgePack | undefined, detectedSubjects: string[], outline: string): string[] {
  const entries = [
    ...(knowledgePack?.primary_entries ?? []),
    ...(knowledgePack?.supporting_entries ?? []),
  ];
  const fromEntries = entries.flatMap(entry => [
    entry.entry_name.split('——')[0],
    entry.era,
    ...entry.keywords.slice(0, 2),
  ]);
  const fromOutline = detectedSubjects.length > 0 ? detectedSubjects : outline.split(/[，。；：！？\s]+/).filter(Boolean);
  return unique([...fromEntries, ...fromOutline].filter((item): item is string => Boolean(item && item.length >= 2))).slice(0, 12);
}

function buildMotifs(knowledgeFocus: string[], emotions: string[]): string[] {
  return unique([
    ...knowledgeFocus.slice(0, 3).map(item => `${item}的可视化符号`),
    ...emotions.slice(0, 2).map(item => `${item}的色彩和表情节奏`),
    '每阶段重复出现但含义变化的关键物件',
  ]);
}

function summarizeText(text: string, maxLength: number): string {
  const compact = text.replace(/\s+/g, '').trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength)}...` : compact;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}
