import fs from 'node:fs/promises';
import path from 'node:path';

type ProductionMaterialPackDraftStatus = 'ready_for_editor_review' | 'needs_more_sources';

interface SourceObservation {
  source_id: string;
  source_type?: string;
  applies_to_video_types?: string[];
  title?: string;
  url?: string;
  usable_takeaways?: string[];
  limitations?: string[];
}

interface ProductionMaterialTemplate {
  required_fields: string[];
  prompt_layers?: string[];
  minimum_viable_story_gate: string[];
  script_ready_gate: string[];
  production_ready_gate: string[];
  supplement_questions: string[];
}

interface ProductionMaterialPack {
  video_type: string;
  label: string;
  goal: string;
  material_template: ProductionMaterialTemplate;
  sample_entries: unknown[];
}

interface ProductionMaterialPackFile {
  schema_version: string;
  source_observations?: SourceObservation[];
  packs?: ProductionMaterialPack[];
}

export interface DraftProductionMaterialPackOptions {
  videoType: string;
  label?: string;
  goal?: string;
  additionalObservations?: SourceObservation[];
  generatedAt?: string;
}

export interface ProductionMaterialPackDraftReport {
  schema_version: 'production-material-pack-draft/v1';
  generated_at: string;
  status: ProductionMaterialPackDraftStatus;
  video_type: string;
  source_count: number;
  source_ids: string[];
  matched_observations: SourceObservation[];
  draft_pack: ProductionMaterialPack;
  review_checklist: string[];
  warnings: string[];
  markdown: string;
}

export async function draftProductionMaterialPack(
  options: DraftProductionMaterialPackOptions,
): Promise<ProductionMaterialPackDraftReport> {
  const videoType = options.videoType.trim();
  if (!videoType) throw new Error('videoType is required');

  const packFile = await readProductionPackFile();
  const existingPack = packFile.packs?.find(pack => pack.video_type === videoType);
  const matchedObservations = [
    ...(packFile.source_observations ?? []),
    ...(options.additionalObservations ?? []),
  ].filter(observation => appliesToVideoType(observation, videoType));
  const sourceIds = matchedObservations.map(item => item.source_id).filter(uniqueString);
  const warnings = buildWarnings(existingPack, matchedObservations);
  const template = buildDraftTemplate(videoType, existingPack, matchedObservations);
  const draftPack: ProductionMaterialPack = {
    video_type: videoType,
    label: options.label?.trim() || existingPack?.label || defaultLabel(videoType),
    goal: options.goal?.trim() || existingPack?.goal || defaultGoal(videoType),
    material_template: template,
    sample_entries: existingPack?.sample_entries ?? [],
  };
  const base: Omit<ProductionMaterialPackDraftReport, 'markdown'> = {
    schema_version: 'production-material-pack-draft/v1',
    generated_at: options.generatedAt ?? new Date().toISOString(),
    status: matchedObservations.length >= 3 ? 'ready_for_editor_review' : 'needs_more_sources',
    video_type: videoType,
    source_count: matchedObservations.length,
    source_ids: sourceIds,
    matched_observations: matchedObservations,
    draft_pack: draftPack,
    review_checklist: buildReviewChecklist(videoType, existingPack, matchedObservations),
    warnings,
  };

  return {
    ...base,
    markdown: buildMarkdown(base),
  };
}

async function readProductionPackFile(): Promise<ProductionMaterialPackFile> {
  const filePath = path.join(kbRoot(), 'production-packs', 'video-type-material-supplement-packs.json');
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as ProductionMaterialPackFile;
}

function kbRoot(): string {
  return process.env.KB_ROOT || path.resolve(import.meta.dirname, '..', '..', '..', 'data');
}

function appliesToVideoType(observation: SourceObservation, videoType: string): boolean {
  return (observation.applies_to_video_types ?? []).includes(videoType);
}

function buildDraftTemplate(
  videoType: string,
  existingPack: ProductionMaterialPack | undefined,
  observations: SourceObservation[],
): ProductionMaterialTemplate {
  const existing = existingPack?.material_template;
  const sourceText = observations
    .flatMap(observation => observation.usable_takeaways ?? [])
    .join('\n');
  return {
    required_fields: mergeUnique([
      ...(existing?.required_fields ?? []),
      ...defaultRequiredFields(videoType),
      ...fieldsFromTakeaways(sourceText),
    ]).slice(0, 24),
    prompt_layers: mergeUnique([
      ...(existing?.prompt_layers ?? []),
      ...defaultPromptLayers(videoType),
    ]).slice(0, 10),
    minimum_viable_story_gate: mergeUnique([
      ...(existing?.minimum_viable_story_gate ?? []),
      ...defaultMinimumGate(videoType),
    ]).slice(0, 8),
    script_ready_gate: mergeUnique([
      ...(existing?.script_ready_gate ?? []),
      ...defaultScriptGate(videoType),
    ]).slice(0, 8),
    production_ready_gate: mergeUnique([
      ...(existing?.production_ready_gate ?? []),
      ...defaultProductionGate(videoType),
    ]).slice(0, 10),
    supplement_questions: mergeUnique([
      ...(existing?.supplement_questions ?? []),
      ...questionsFromObservations(observations),
      ...defaultQuestions(videoType),
    ]).slice(0, 14),
  };
}

function fieldsFromTakeaways(text: string): string[] {
  const rules: Array<[RegExp, string[]]> = [
    [/参考图|关键帧|多模态|图片|视频|音频/, ['reference_images_or_keyframes', 'multimodal_input_assets']],
    [/角色|身份|一致性|服饰|外观/, ['character_stability', 'appearance_and_costume_anchors']],
    [/场景|空间|地点|环境/, ['scene_anchors', 'location_and_environment_details']],
    [/动作|运动|视线|表情/, ['action_beats', 'expression_and_motion_notes']],
    [/镜头|构图|运镜|分镜/, ['shot_plan', 'camera_and_composition']],
    [/B-roll|空镜|档案|访谈|旁白/, ['interview_or_voiceover_text', 'b_roll_plan', 'archive_or_field_assets']],
    [/流程|工序|材料|工具|手部/, ['process_steps', 'materials', 'tools', 'hand_actions']],
    [/来源|官方|核验|边界|再现/, ['confirmed_sources', 'verification_boundary', 'reenactment_boundary']],
    [/钩子|前三秒|反转|追看/, ['opening_hook', 'turning_point_or_reveal', 'ending_hook']],
    [/学习|知识|步骤|复盘|练习/, ['learning_objective', 'step_sequence', 'example_bank', 'recap_or_practice']],
  ];
  return rules.flatMap(([pattern, fields]) => pattern.test(text) ? fields : []);
}

function questionsFromObservations(observations: SourceObservation[]): string[] {
  return observations
    .flatMap(observation => observation.usable_takeaways ?? [])
    .map(takeaway => takeawayToQuestion(takeaway))
    .filter(Boolean)
    .filter(uniqueString)
    .slice(0, 8);
}

function takeawayToQuestion(takeaway: string): string {
  const clean = takeaway.replace(/[。.!！]+$/g, '').trim();
  if (!clean) return '';
  if (clean.includes('需要') || clean.includes('应')) {
    return `${clean}，当前素材是否已补齐？`;
  }
  return `如何把「${clean.slice(0, 48)}」转成可核验的素材字段？`;
}

function defaultRequiredFields(videoType: string): string[] {
  const generic = [
    'target_audience',
    'communication_goal',
    'confirmed_sources',
    'core_message_or_conflict',
    'visual_assets',
    'production_boundaries',
    'delivery_acceptance_checks',
  ];
  const byType: Record<string, string[]> = {
    social_short: ['opening_hook', 'platform_context', 'share_trigger', 'comment_prompt', 'vertical_shot_plan'],
    explainer_video: ['learning_objective', 'knowledge_layers', 'example_bank', 'step_sequence', 'recap_or_practice'],
    lecture_video: ['speaker_position', 'knowledge_outline', 'case_examples', 'slide_or_board_assets', 'audience_takeaway'],
    education_training: ['learning_objective', 'learner_profile', 'step_sequence', 'practice_task', 'assessment_check'],
    city_brand_promo: ['city_positioning', 'route_nodes', 'landmark_assets', 'seasonal_light', 'life_scene_anchors'],
  };
  return [...generic, ...(byType[videoType] ?? [])];
}

function defaultPromptLayers(videoType: string): string[] {
  if (videoType === 'ai_comic_drama') return ['基础设定', '氛围画质', '画面内容', '连续性验收'];
  if (videoType === 'documentary_short') return ['现实现场', '访谈/旁白', 'B-roll', '档案/再现边界'];
  if (videoType === 'heritage_promo') return ['材料工具', '工序动作', '传承关系', '当代连接'];
  return ['受众与目标', '内容结构', '视觉/声音资产', '事实边界', '交付验收'];
}

function defaultMinimumGate(videoType: string): string[] {
  return [
    `有明确 ${videoType} 成片目标和受众`,
    '有至少一个可信来源入口',
    '有可视化主体或可听见的讲述主体',
    '能说明本片为什么现在值得制作',
  ];
}

function defaultScriptGate(videoType: string): string[] {
  return [
    '脚本结构可分成开场、展开、转折/证明和收束',
    '每一段都有可见动作、例子、现场或论据',
    '事实、观点和再现边界已分开标注',
    '能从素材字段推导出 scene_breakdown 或分段供稿',
  ];
}

function defaultProductionGate(videoType: string): string[] {
  return [
    '角色/讲述者、场景、道具/图像、声音和字幕关键词已列清',
    '可区分实拍、档案、示意、再现和 AI 生成画面',
    '禁用表达、授权边界和核验责任已标明',
    '有交付验收项：连续性、可拍性、来源边界和平台规格',
  ];
}

function defaultQuestions(videoType: string): string[] {
  return [
    `这个 ${videoType} 的目标观众是谁，3 秒内要让他看见什么？`,
    '哪些事实必须来自可核验来源，哪些只是创作表达？',
    '有哪些角色、地点、道具、图像或声音资产必须稳定复用？',
    '如果进入生产，最可能导致返工的缺口是什么？',
  ];
}

function defaultLabel(videoType: string): string {
  return `${videoType} 生产素材包草案`;
}

function defaultGoal(videoType: string): string {
  return `把 ${videoType} 从通用资料组织成可生成脚本、分镜和交付资产的生产素材模板。`;
}

function buildReviewChecklist(
  videoType: string,
  existingPack: ProductionMaterialPack | undefined,
  observations: SourceObservation[],
): string[] {
  return [
    `确认所有来源只适用于 ${videoType}，不要跨类型套用爆款方法。`,
    `至少补足 3 个来源后再写入正式 ProductionMaterialPack；当前 ${observations.length} 个。`,
    '人工审查 required_fields 是否能驱动 minimum_viable_story、script_ready、production_ready 三阶段 gate。',
    '补 10 条高质量 sample_entries，每条包含 source_status、core_story_engine、must_collect、visual_assets、risk_boundary。',
    '写入正式 JSON 后运行 story prompt、readiness、quality workflow 和前端展示测试。',
    existingPack ? '该类型已有正式包：本草案只用于增量审稿，不应盲目覆盖。' : '该类型暂无正式包：写入前需新增跨类型隔离测试。',
  ];
}

function buildWarnings(
  existingPack: ProductionMaterialPack | undefined,
  observations: SourceObservation[],
): string[] {
  const warnings: string[] = [];
  if (observations.length < 3) warnings.push('外部来源少于 3 个，只能作为草案，不能直接写入正式包。');
  if (existingPack) warnings.push('目标 video_type 已有正式 ProductionMaterialPack，建议走增量审稿。');
  if (observations.some(item => (item.limitations ?? []).length > 0)) warnings.push('部分来源有 limitations，写入正式模板前需人工复核。');
  return warnings;
}

function buildMarkdown(report: Omit<ProductionMaterialPackDraftReport, 'markdown'>): string {
  const lines = [
    `# ${report.video_type} 生产素材包草案`,
    '',
    `- 生成时间：${report.generated_at}`,
    `- 状态：${report.status}`,
    `- 来源数：${report.source_count}`,
    `- 来源ID：${report.source_ids.join('、') || '无'}`,
    '',
    '## 草案包',
    '',
    `- label：${report.draft_pack.label}`,
    `- goal：${report.draft_pack.goal}`,
    '',
    '### Required Fields',
    ...report.draft_pack.material_template.required_fields.map(field => `- ${field}`),
    '',
    '### Prompt Layers',
    ...(report.draft_pack.material_template.prompt_layers ?? []).map(layer => `- ${layer}`),
    '',
    '### Gates',
    '',
    '**Minimum Viable Story**',
    ...report.draft_pack.material_template.minimum_viable_story_gate.map(item => `- ${item}`),
    '',
    '**Script Ready**',
    ...report.draft_pack.material_template.script_ready_gate.map(item => `- ${item}`),
    '',
    '**Production Ready**',
    ...report.draft_pack.material_template.production_ready_gate.map(item => `- ${item}`),
    '',
    '### Supplement Questions',
    ...report.draft_pack.material_template.supplement_questions.map(item => `- ${item}`),
    '',
    '## 来源摘录',
    ...report.matched_observations.flatMap(observation => [
      '',
      `### ${observation.source_id}`,
      `- 类型：${observation.source_type ?? 'unknown'}`,
      `- 标题：${observation.title ?? '未记录'}`,
      ...(observation.url ? [`- URL：${observation.url}`] : []),
      ...((observation.usable_takeaways ?? []).slice(0, 5).map(item => `- ${item}`)),
    ]),
    '',
    '## 审稿清单',
    ...report.review_checklist.map(item => `- ${item}`),
  ];
  if (report.warnings.length > 0) {
    lines.push('', '## 警告', ...report.warnings.map(item => `- ${item}`));
  }
  return `${lines.join('\n')}\n`;
}

function mergeUnique(values: string[]): string[] {
  return values.map(item => item.trim()).filter(Boolean).filter(uniqueString);
}

function uniqueString(value: string, index: number, arr: string[]): boolean {
  return arr.indexOf(value) === index;
}
