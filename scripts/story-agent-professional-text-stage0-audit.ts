import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GenreStoryProfile } from '../web/server/src/services/genre-story-profiles.js';
import type { VideoType } from '../web/shared/types.js';

type JsonRecord = Record<string, unknown>;

interface ProfessionalExpectation {
  line: '剧情故事线' | '宣传传播线' | '非虚构与知识线' | '空间与意境线';
  required_deliverables: string[];
  exclusive_quality_gate: string;
}

interface ProgressDimension {
  dimension_id: string;
  label: string;
  weight_percent: number;
  completed_evidence_units: number;
  total_evidence_units: number;
  completion_ratio: number;
  earned_percent: number;
  calculation_rule: string;
  evidence: string[];
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const writeMode = process.argv.includes('--write');
const checkMode = process.argv.includes('--check');
const validatedMode = process.argv.includes('--validated');

const VIDEO_TYPES: VideoType[] = [
  'character_story',
  'historical_drama',
  'legend_story',
  'ai_comic_drama',
  'children_story',
  'culture_promo',
  'heritage_promo',
  'city_brand_promo',
  'social_short',
  'documentary_short',
  'explainer_video',
  'lecture_video',
  'education_training',
  'scene_short',
  'landscape_mood',
];

const PROFESSIONAL_EXPECTATIONS: Record<VideoType, ProfessionalExpectation> = {
  character_story: {
    line: '剧情故事线',
    required_deliverables: ['人物命题', '关键选择', '关系网', '人物弧', '分场剧本'],
    exclusive_quality_gate: '不能写成年表；选择必须造成代价和变化',
  },
  historical_drama: {
    line: '剧情故事线',
    required_deliverables: ['史实压力', '事件因果', '角色立场', '戏剧化边界', '分场剧本'],
    exclusive_quality_gate: '事实和虚构分层；冲突必须来自时代处境',
  },
  legend_story: {
    line: '剧情故事线',
    required_deliverables: ['版本说明', '象征意象', '凡人选择', '口述节奏', '完整剧本'],
    exclusive_quality_gate: '不把传说写成史实；象征必须服务人物选择',
  },
  ai_comic_drama: {
    line: '剧情故事线',
    required_deliverables: ['集钩子', '关系碰撞', '可分格动作', '对白气泡', '表情节拍', '结尾钩子'],
    exclusive_quality_gate: '每格可画；角色和资产连续；对白不能承担全部叙事',
  },
  children_story: {
    line: '剧情故事线',
    required_deliverables: ['年龄段', '温和冲突', '重复母题', '情绪学习', '亲师提示'],
    exclusive_quality_gate: '儿童可理解；不残酷、不恐吓、不把说教当情节',
  },
  culture_promo: {
    line: '宣传传播线',
    required_deliverables: ['传播命题', '视觉符号', '信息曲线', '旁白', '行动召唤'],
    exclusive_quality_gate: '不能只有赞美；文化细节必须承担叙事功能',
  },
  heritage_promo: {
    line: '宣传传播线',
    required_deliverables: ['材料', '工具', '工序', '手部动作', '传承压力', '当代连接'],
    exclusive_quality_gate: '工序可拍；授权和危险操作边界清楚',
  },
  city_brand_promo: {
    line: '宣传传播线',
    required_deliverables: ['城市主张', '人物视角', '空间路线', '城市证据', '品牌落点'],
    exclusive_quality_gate: '避免城市宣传套话；地理、生活和人物必须真实关联',
  },
  social_short: {
    line: '宣传传播线',
    required_deliverables: ['三秒钩子', '节拍表', '反差', '字幕', '竖屏画面', '互动问题'],
    exclusive_quality_gate: '60 至 90 秒内持续有新信息；事实边界不能被钩子牺牲',
  },
  documentary_short: {
    line: '非虚构与知识线',
    required_deliverables: ['核心问题', '现实现场', '采访角色', '史料线索', 'B-roll', '再现边界'],
    exclusive_quality_gate: '不虚构采访或现场；旁白克制；证据推动发现',
  },
  explainer_video: {
    line: '非虚构与知识线',
    required_deliverables: ['问题', '概念', '例子', '视觉比喻', '误区', '总结'],
    exclusive_quality_gate: '一段只讲一个核心概念；画面能解释而非装饰',
  },
  lecture_video: {
    line: '非虚构与知识线',
    required_deliverables: ['立论', '论证', '案例', '反方', '修辞转场', '行动结论'],
    exclusive_quality_gate: '论点可验证；不是资料罗列或口号堆叠',
  },
  education_training: {
    line: '非虚构与知识线',
    required_deliverables: ['学习目标', '知识步骤', '案例', '练习', '评估', '复盘'],
    exclusive_quality_gate: '能教会和检验；练习与目标对应',
  },
  scene_short: {
    line: '空间与意境线',
    required_deliverables: ['空间路线', '人物或事件触发', '镜头行动', '声音', '转场'],
    exclusive_quality_gate: '空间必须发生变化或发现，不能只是景点介绍',
  },
  landscape_mood: {
    line: '空间与意境线',
    required_deliverables: ['情绪命题', '时间变化', '构图节奏', '自然声音', '极简文案'],
    exclusive_quality_gate: '情绪由视听建立；文案不能压过画面',
  },
};

const EXPLICIT_SEMANTIC_QUALITY_EVIDENCE: Partial<Record<VideoType, string[]>> = {
  character_story: ['目标/阻力/选择代价语义证据', '反年表检查', '人物精神落点'],
  historical_drama: ['事件因果', '时代/制度压力', '史实边界'],
  ai_comic_drama: ['对白或强旁白', '结尾钩子', '表情动作/名场面'],
  heritage_promo: ['流程顺序', '材料工具', '传承动作'],
  documentary_short: ['现实现场', '来源提示', '版本/再现边界'],
  culture_promo: ['核心主张', '视觉符号', '当代连接'],
};

const PROFESSIONAL_UNIFORM_FIELDS = [
  'creative_brief',
  'audience_promise',
  'premise_or_core_question',
  'theme_statement',
  'truth_and_adaptation_contract',
  'structure_outline',
  'sequence_beats',
  'scene_breakdown',
  'full_text',
  'dialogue_or_narration_pass',
  'director_text_plan',
  'continuity_ledger',
  'quality_report',
  'coverage_report',
  'revision_trace',
  'delivery_text_package',
];

const PROFESSIONAL_QUALITY_DIMENSIONS = [
  'creative_brief_and_audience_promise',
  'premise_and_theme_unity',
  'structure_causality_and_pacing',
  'character_agency_and_relationship_change',
  'scene_function_visible_action_and_blocking',
  'dialogue_narration_and_subtext',
  'emotional_curve_and_aftertaste',
  'cultural_fact_and_adaptation_boundary',
  'production_executability',
  'originality_and_distinctiveness',
];

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function readJson(filePath: string): Promise<JsonRecord> {
  const value = JSON.parse(await fs.readFile(filePath, 'utf8')) as unknown;
  if (!isRecord(value)) throw new Error(`Expected JSON object: ${filePath}`);
  return value;
}

async function listFiles(rootPath: string, suffix: string): Promise<string[]> {
  const files: string[] = [];
  async function visit(currentPath: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) await visit(entryPath);
      else if (entry.isFile() && entry.name.endsWith(suffix)) files.push(entryPath);
    }
  }
  await visit(rootPath);
  return files.sort();
}

function profileContractComplete(profile: GenreStoryProfile): boolean {
  return Boolean(
    profile.narrative_promise
    && profile.text_shape
    && profile.framework.length
    && profile.must_include.length
    && profile.avoid.length
    && profile.scene_rules.length
    && profile.gears_rules.length
    && profile.quality_rules.length
    && profile.repair_guidance.length
    && profile.material_requirements.length
    && profile.truth_rules.length
    && profile.adaptation_rules.length
    && profile.dramatic_structure.scene_templates.length,
  );
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function progressDimension(input: Omit<ProgressDimension, 'completion_ratio' | 'earned_percent'>): ProgressDimension {
  const completionRatio = input.total_evidence_units > 0
    ? input.completed_evidence_units / input.total_evidence_units
    : 0;
  return {
    ...input,
    completion_ratio: round(completionRatio, 4),
    earned_percent: round(input.weight_percent * completionRatio),
  };
}

function containsAll(source: string, fragments: string[]): boolean {
  return fragments.every(fragment => source.includes(fragment));
}

function renderMatrixMarkdown(matrix: JsonRecord): string {
  const rows = matrix.video_types as JsonRecord[];
  const summary = matrix.summary as JsonRecord;
  const lines = [
    '# Story Agent 全片型专业文本能力矩阵',
    '',
    `> schema_version: ${matrix.schema_version}`,
    `> generated_at: ${matrix.generated_at}`,
    '> 口径：现有结构能力与专业验收分开；fixture/simulation 不计专业通过。',
    '',
    '## 总览',
    '',
    `- VideoType 覆盖：${summary.video_type_coverage_count}/15`,
    `- 完整 legacy GenreStoryProfile：${summary.legacy_profile_contract_count}/15`,
    `- 结构化生成主链：${summary.legacy_structural_generation_count}/15`,
    `- ProfessionalTextPackage 合同：${summary.professional_text_package_contract_count}/15`,
    `- ProfessionalTextPackage 合法骨架：${summary.professional_text_package_skeleton_schema_pass_count}/15`,
    `- ProfessionalTextPackage 通过：${summary.professional_text_package_pass_count}/15`,
    `- ProductionMaterialPack：${summary.production_material_pack_count}/15`,
    `- 黄金卡草案：${summary.golden_card_draft_count}，人工通过：${summary.human_approved_golden_card_count}`,
    `- fixture 回归：${summary.fixture_regression_count}（排除于专业通过）`,
    `- character_story 固定项目规格：${summary.fixed_project_spec_count}/5；失败 fixture：${summary.failure_fixture_count}/3`,
    `- historical_drama 固定项目规格：${summary.historical_drama_fixed_project_spec_count}/5；失败 fixture：${summary.historical_drama_failure_fixture_count}/3`,
    `- legend_story 固定项目规格：${summary.legend_story_fixed_project_spec_count}/5；失败 fixture：${summary.legend_story_failure_fixture_count}/3`,
    `- children_story 固定项目规格：${summary.children_story_fixed_project_spec_count}/5；失败 fixture：${summary.children_story_failure_fixture_count}/3`,
    `- ai_comic_drama 固定项目规格：${summary.ai_comic_drama_fixed_project_spec_count}/5；失败 fixture：${summary.ai_comic_drama_failure_fixture_count}/3`,
    `- culture_promo 固定项目规格：${summary.culture_promo_fixed_project_spec_count}/5；失败 fixture：${summary.culture_promo_failure_fixture_count}/3`,
    `- heritage_promo 固定项目规格：${summary.heritage_promo_fixed_project_spec_count}/5；失败 fixture：${summary.heritage_promo_failure_fixture_count}/3`,
    `- city_brand_promo 固定项目规格：${summary.city_brand_promo_fixed_project_spec_count}/5；失败 fixture：${summary.city_brand_promo_failure_fixture_count}/3`,
    `- social_short 固定项目规格：${summary.social_short_fixed_project_spec_count}/5；失败 fixture：${summary.social_short_failure_fixture_count}/3`,
    `- documentary_short 固定项目规格：${summary.documentary_short_fixed_project_spec_count}/5；失败 fixture：${summary.documentary_short_failure_fixture_count}/3`,
    `- explainer_video 固定项目规格：${summary.explainer_video_fixed_project_spec_count}/5；失败 fixture：${summary.explainer_video_failure_fixture_count}/3`,
    `- lecture_video 固定项目规格：${summary.lecture_video_fixed_project_spec_count}/5；失败 fixture：${summary.lecture_video_failure_fixture_count}/3`,
    `- education_training 固定项目规格：${summary.education_training_fixed_project_spec_count}/5；失败 fixture：${summary.education_training_failure_fixture_count}/3`,
    `- scene_short 固定项目规格：${summary.scene_short_fixed_project_spec_count}/5；失败 fixture：${summary.scene_short_failure_fixture_count}/3`,
    `- landscape_mood 固定项目规格：${summary.landscape_mood_fixed_project_spec_count}/5；失败 fixture：${summary.landscape_mood_failure_fixture_count}/3`,
    `- 十五片型项目规格/失败 fixture 总计：${summary.fixed_project_spec_total_count}/75；${summary.failure_fixture_total_count}/45（均不计专业通过）`,
    `- Stage 6 多轮修订项目规格：${summary.multi_round_revision_project_spec_count}/15；完成两轮真实修订：${summary.completed_two_round_verified_project_count}/15；已验证真实修订轮次：${summary.recorded_verified_revision_round_count}`,
    `- Coverage/桌读/多轮修订合同：${summary.multi_round_revision_contract_implemented ? '已建立' : '未建立'}；失败 fixture：${summary.multi_round_revision_failure_fixture_count}/3（不计真实修订）`,
    `- Stage 6 执行批次：计划 ${summary.planned_revision_round_count}/30 轮；阻断项目 ${summary.blocked_revision_project_count}/15；Round 1 可执行 ${summary.ready_for_round_1_project_count}/15`,
    `- character_story 源快照/执行包：${summary.benchmark_source_snapshot_ready_count}/5；strict bridge/CLI 技术锚：${summary.strict_technical_ready_count}/5；授权执行：${summary.real_model_execution_ready_count}/5`,
    `- 受控运行计划/prepared ledger/阻断：${summary.controlled_run_plan_project_count}/${summary.prepared_run_ledger_count}/${summary.controlled_blocked_run_count}；模型调用/真实完成：${summary.model_invocation_count}/${summary.real_model_completed_count}`,
    `- prompt/完整场景/strict bridge/run ledger/artifact/盲评阈值合同：${summary.benchmark_prompt_contract_type_count}/${summary.strict_scene_output_contract_type_count}/${summary.strict_real_model_bridge_type_count}/${summary.benchmark_run_ledger_type_count}/${summary.artifact_integrity_contract_type_count}/${summary.blind_review_threshold_contract_type_count}`,
    `- 初稿后协调器/终审候选门禁/生命周期计划：${summary.post_initial_coordinator_type_count}/${summary.finalization_candidate_gate_type_count}/${summary.lifecycle_plan_type_count}；待真实初稿 ${summary.lifecycle_awaiting_verified_initial_count}/5；候选/签署 ${summary.finalization_candidate_count}/${summary.signed_release_count}`,
    `- 专业纵向管线/质量评估器/修订计划器：${summary.professional_vertical_pipeline_type_count}/${summary.professional_quality_evaluator_type_count}/${summary.professional_revision_planner_type_count}`,
    `- 固定真实回归项目：${summary.fixed_real_model_regression_project_count}/75`,
    `- 真人盲评通过：${summary.human_blind_review_pass_project_count}/45`,
    '',
    '## 15 类矩阵',
    '',
    '| VideoType | 片型线 | Profile | 主链 | 专业合同/骨架 | 语义质量 | 修复 | 素材包 | 黄金卡 草案/人审通过 | fixture | 专业通过 |',
    '|---|---|---:|---:|---:|---|---|---:|---:|---:|---:|',
    ...rows.map(row => {
      const quality = row.quality_support as JsonRecord;
      const repair = row.repair_support as JsonRecord;
      const material = row.material_and_benchmark_support as JsonRecord;
      return `| \`${row.video_type}\` | ${row.line} | ${row.legacy_profile_contract_complete ? '✓' : '✗'} | ${row.legacy_structural_generation_supported ? '✓' : '✗'} | ${row.professional_text_package_contract_implemented && row.professional_text_package_skeleton_schema_passed ? '✓/✓' : '✗/✗'} | ${quality.status} | ${repair.status} | ${material.production_material_pack_present ? '✓' : '✗'} | ${material.golden_card_draft_count}/${material.human_approved_golden_card_count} | ${material.fixture_regression_count} | ${row.professional_text_package_passed ? '✓' : '✗'} |`;
    }),
    '',
    '## 逐片型缺口',
    '',
  ];

  for (const row of rows) {
    const quality = row.quality_support as JsonRecord;
    const material = row.material_and_benchmark_support as JsonRecord;
    lines.push(
      `### ${row.label}（\`${row.video_type}\`）`,
      '',
      `- 专业必交文本：${(row.professional_required_deliverables as string[]).join('、')}`,
      `- 专属质量门槛：${row.professional_exclusive_quality_gate}`,
      `- 专业合同/合法骨架：${row.professional_text_package_contract_implemented ? '有' : '无'}/${row.professional_text_package_skeleton_schema_passed ? '通过' : '未通过'}`,
      `- 当前 legacy 输出字段：${(row.legacy_output_contract_fields as string[]).join('、')}`,
      `- 当前质量证据：${(quality.explicit_semantic_evidence as string[]).join('、') || '仅通用 profile 信号/字符串诊断'}`,
      `- 素材与样本：ProductionMaterialPack=${material.production_material_pack_present ? '有' : '无'}；黄金卡草案=${material.golden_card_draft_count}；fixture=${material.fixture_regression_count}`,
      `- 专业缺口：${(row.professional_gaps as string[]).join('；')}`,
      '',
    );
  }
  return `${lines.join('\n').trim()}\n`;
}

function renderGapMarkdown(input: {
  generatedAt: string;
  summary: JsonRecord;
  progress: JsonRecord;
  matrix: JsonRecord;
}): string {
  const dimensions = input.progress.dimensions as ProgressDimension[];
  const validation = input.progress.validation_checkpoint as JsonRecord;
  const validationLines = validation.status === 'passed'
    ? [
        '- MCP：79 个测试文件、345 个用例通过。',
        '- Web Server：61 个测试文件、711 个用例通过。',
        '- MCP TypeScript 构建通过。',
        '- Web 可见文案审计、Server/Client 类型检查通过。',
        '- 知识库 lint：34 个省份文件、169 条条目、169 条增强条目通过。',
        '- 专业文本审计器、治理 manifest 合同、JSON 解析和 git diff whitespace 检查通过。',
        '- character_story 固定项目执行预检合同通过；未调用模型、未写生成故事。',
        '- character_story 受控运行计划 5/5 prepared、5/5 blocked；模型调用 0、真实完成 0、专业通过 0。',
      ]
    : ['- 尚未记录完整验证检查点；不得据此声明当前 Iteration 验证通过。'];
  const lines = [
    '# Story Agent 专业文本创作当前缺口报告',
    '',
    `> generated_at: ${input.generatedAt}`,
    `> Stage: ${input.matrix.stage} / ${input.matrix.iteration}`,
    '> 原则：合同与骨架不等于专业成稿；simulation/fixture 不计专业质量通过。',
    '',
    '## 基线结论',
    '',
    '- 15/15 片型拥有独立 GenreStoryProfile，并可进入现有 StoryBlueprint -> full_text -> scene_breakdown -> gears_segments 主链。',
    '- 15/15 片型拥有 ProfessionalTextPackage 合同、片型必填映射、十维权重、硬门槛和 schema 合法骨架；这些骨架全部明确为未评测。',
    '- ProfessionalTextPackage 专业通过仍为 0/15；合同或候选评估器存在不代表真实文本、修订增量或真人评审通过。',
    '- character_story 已有 opt-in 专业纵向管线、十维候选评估、10 项硬门槛、定向修订计划和派生文本重建；没有接入现有生成行为，也没有把机器分数升级为专业结论。',
    '- historical_drama 已增加独立 opt-in 专业纵向管线、因果链与角色立场评估、逐场史实/戏剧化边界、定向修订与派生文本重建；同样不改变现有生成入口。',
    '- legend_story 已增加独立 opt-in 专业纵向管线、版本边界、神异功能、凡人选择、重复意象、口述节奏和定向修订；传说内容不被提升为确证历史。',
    '- children_story 已增加独立 opt-in 专业纵向管线、年龄和语言层级、温和风险、尝试因果、情绪学习、重复母题、儿童安全与亲师提示门禁。',
    '- ai_comic_drama 已增加独立 opt-in 格级专业管线、集钩子、关系碰撞、3-6格动作、短气泡、反应格、结尾动作钩子和资产连续性门禁。',
    '- culture_promo 已增加传播命题、视觉符号、文化证据、信息曲线、旁白/画面分工、当代连接和行动召唤门禁。',
    '- 5/5 固定项目已有知识源快照、实际专业 prompt、prepared ledger、受控运行计划和全生命周期待办；严格 bridge/CLI 技术锚 5/5，但 operator、付费、凭据和预算授权仍未成立。当前 5/5 显式 blocked，模型调用与真实完成均为 0。',
    '- 初稿后协调器可从已验证外部初稿生成初始专业文本包、候选评分与修订工单；终审门禁只产生 signed-release 候选，当前 signed release 仍为 0。',
    '- 15/15 片型均已有 opt-in 专业纵向管线、候选质量评估器和修订计划器；原创性等专业判断仍需要固定真实基准、真实项目多轮修订和真人盲评。',
    '- 30 张黄金卡全部 pending_human_review；9 个回归样本全部是 local fixture；两者均不计专业通过。',
    '- 固定真实模型项目、真人盲评通过项目、正式晋升候选 Domain Pack 均为 0。',
    '',
    '## professional_text_creation_progress 计算',
    '',
    '| 维度 | 权重 | 证据单元 | 比例 | 获得进度 |',
    '|---|---:|---:|---:|---:|',
    ...dimensions.map(item => `| ${item.label} | ${item.weight_percent}% | ${item.completed_evidence_units}/${item.total_evidence_units} | ${(item.completion_ratio * 100).toFixed(2)}% | ${item.earned_percent}% |`),
    `| **合计** | **100%** |  |  | **${input.progress.professional_text_creation_progress_percent}%** |`,
    '',
    '该百分比由上述验收证据单元现场计算；Stage 0 首次基线为 27.5%，不继承素材库 99%、Story Agent 产品进度或 GEARS 进度。',
    '',
    '## P0 缺口',
    '',
    '1. character_story 已完成 fail-closed 真实执行与全生命周期合同；dedicated bridge/CLI 技术锚为 5/5，但凭据、独立付费授权和预算门槛未满足，尚无真实模型初稿。',
    '2. 五个剧情片型、四个宣传传播片型、四个非虚构知识片型、scene_short 和 landscape_mood 均已有候选评分、结构化 coverage 和修订路由；但尚无真实项目多轮质量增量证据。',
    '3. 15 类固定真实模型项目为 0/75；不能用 9 个本地 fixture 替代。',
    '4. 真人盲评通过为 0/45；没有编剧/导演/事实文化三角色签署证据。',
    '5. 人工通过黄金卡为 0/75；30 张草案仍待来源、授权和片型审稿。',
    '',
    '## P1 缺口',
    '',
    `1. ProductionMaterialPack 已覆盖 ${input.summary.production_material_pack_count}/15；继续提升条目级素材完整度和跨领域样板，而不是补空片型。`,
    '2. 只有 6 类出现较明确的语义质量证据；其余片型主要依赖通用 profile 信号与字符串命中。',
    '3. 本地确定性质量修复只针对 ai_comic_drama；其他片型依赖通用模型重写，缺少片型级修订证明。',
    '4. 十五个片型均具备 opt-in 专业文本包构建管线；下一缺口是 Coverage、桌读和两轮以上修订的真实项目闭环。',
    '5. UI 可选择 15 类并查看通用质量/修复，但尚未编辑 CreativeBrief、BeatSheet、Coverage、导演文本、评审签署和定稿状态。',
    '',
    '## 片型线缺口汇总',
    '',
  ];

  const rows = input.matrix.video_types as JsonRecord[];
  for (const line of ['剧情故事线', '宣传传播线', '非虚构与知识线', '空间与意境线']) {
    const lineRows = rows.filter(row => row.line === line);
    lines.push(
      `- ${line}：${lineRows.length} 类；专业包通过 0；素材包覆盖 ${lineRows.filter(row => (row.material_and_benchmark_support as JsonRecord).production_material_pack_present).length}/${lineRows.length}；人工通过黄金卡 0。`,
    );
  }

  const governance = input.progress.parallel_governance_track as JsonRecord;
  lines.push(
    '',
    '## 并行治理轨道（不计专业文本进度）',
    '',
    `- 软归档/重建候选：${governance.archive_or_rebuild_candidate_count}；已通过可逆 manifest 排除签收 ${governance.soft_archive_signoff_excluded_count ?? 0}，项目 JSON 未改写。`,
    `- 断链恢复候选：${governance.relink_candidate_count}；安全自动恢复 ${governance.safe_auto_relink_count}，后缀线索人工核验 ${governance.suffix_hint_manual_review_count}。`,
    `- 目标项目外部回片：external_ready=${governance.target_external_ready_count}，local_acceptance_ready=${governance.target_local_acceptance_ready_count}，待真实 artifact=${governance.target_pending_external_artifact_count}。`,
    '- 综合执行顺序和退出条件见 `docs/story-agent-integrated-execution-plan-20260710.md`。',
  );

  lines.push(
    '',
    '## Stage 6 / Iteration 2 当前状态与剩余验收',
    '',
    '- 已以 character_story 建立 CreativeBrief -> EvidenceDossier -> BeatSheet -> 分场 -> 成稿 -> Coverage -> 修订的 opt-in 纵向链路。',
    '- 已增加人物目标、阻力、选择、代价、关系变化、可见行动、情绪转折、潜台词和事实边界检查。',
    '- 已固定 5 个真实项目规格和 3 个失败 fixture；规格仍待真实模型运行，fixture 只作为结构回归。',
    '- 已为 5 个项目冻结真实知识条目快照、实际专业 prompt、prepared ledger、CLI/bridge hash 锚、fail-closed 运行计划和初稿到签署的机器生命周期计划；本轮不调用模型、不写生成故事。',
    '- benchmark 逐场输出现在强制完整 StoryScene、事实依据、来源和戏剧化边界；coordinator 不得猜测补齐。',
    '- strict bridge、artifact integrity、盲评阈值和 finalization candidate 通过仅表示合同证据有效；缺 signed release 仍不得专业通过。',
    '- 待独立授权后保存 5 个真实项目的初稿、修订稿、质量增量、模型/提示版本和成本记录。',
    '- 在真人评审完成前仍不声明 character_story 专业通过。',
    '- historical_drama 已建立“单一事件压力 -> 三段以上因果链 -> 角色立场 -> 不可撤回行动 -> 历史后果”的内部合同。',
    '- historical_drama 已固定 5 个项目规格与 3 个失败 fixture；未调用真实模型，项目完成、真人盲评和专业通过均为 0。',
    '- legend_story 已建立“版本边界 -> 神异介入 -> 凡人考验 -> 主动选择 -> 意象回环 -> 流传理由”的内部合同。',
    '- legend_story 已固定 5 个项目规格与 3 个失败 fixture；传说不计史实，未调用真实模型，项目完成、真人盲评和专业通过均为 0。',
    '- children_story 已建立“年龄/语言 -> 温和问题 -> 两次尝试 -> 正向选择 -> 情绪学习 -> 温暖反馈”的内部合同。',
    '- children_story 已固定 5 个项目规格与 3 个失败 fixture；未调用真实模型，儿童发展/安全评审、真人盲评和专业通过均为 0。',
    '- ai_comic_drama 已建立“强画面钩子 -> 关系碰撞 -> 格级动作/表情 -> 可画选择 -> 资产连续 -> 结尾动作钩子”的内部合同。',
    '- 剧情故事线五片型内部合同已齐；25 个规格均未运行真实模型，真人盲评和专业通过仍为 0。',
    '- culture_promo 已建立“传播命题 -> 视觉符号 -> 文化证据 -> 信息递进 -> 当代连接 -> 行动召唤”的内部合同。',
    '- culture_promo 已固定 5 个规格和 3 个失败 fixture，未调用真实模型或完成人审。',
    '- heritage_promo 已建立材料、工具、工序、手部动作、传承压力和授权边界链，并固定 5 个规格和 3 个失败 fixture。',
    '- city_brand_promo 已建立“城市命题 -> 人物视点 -> 空间路线 -> 在地生活 -> 转场逻辑 -> 品牌落点”的内部合同，并固定 5 个规格和 3 个失败 fixture。',
    '- social_short 已建立“前三秒钩子 -> 连续新信息 -> 反差转折 -> 声画字幕分工 -> 互动收束”的60至90秒内部合同，并固定 5 个规格和 3 个失败 fixture。',
    '- documentary_short 已建立“现实问题 -> 现场痕迹 -> 史料来源 -> 授权采访 -> 证据发现 -> 回到当下”的内部合同，并固定 5 个规格和 3 个失败 fixture。',
    '- explainer_video 已建立“核心问题 -> 单段单概念 -> 例子映射 -> 视觉因果 -> 比喻边界 -> 误区纠正 -> 迁移检查”的内部合同，并固定 5 个规格和 3 个失败 fixture。',
    '- lecture_video 已建立“受众张力 -> 核心立论 -> 证据论证 -> 案例 -> 合理反方 -> 回应 -> 行动结论”的内部合同，并固定 5 个规格和 3 个失败 fixture。',
    '- education_training 已建立“可观察目标 -> 知识步骤 -> 示范 -> 练习 -> 评估 -> 反馈 -> 复盘”的内部合同，并固定 5 个规格和 3 个失败 fixture。',
    '- scene_short 已建立“空间身份 -> 路线移动 -> 动作触发 -> 发现/变化 -> 时间层 -> 声音转场 -> 氛围收束”的内部合同，并固定 5 个规格和 3 个失败 fixture。',
    '- landscape_mood 已建立“情绪命题 -> 时间/光线变化 -> 构图停留 -> 自然运动 -> 自然声弧线 -> 极简文案 -> 结尾留白”的内部合同，并固定 5 个规格和 3 个失败 fixture。',
    '- 十五片型共 75 个规格和 45 个失败 fixture 均未被当作真实地点、真实模型或真人专业通过；专业文本进度保持 40%。',
    '- Stage 6 已建立统一六类 Coverage、桌读意见导入、逐轮前后哈希、质量增量、问题关闭和派生文本重建合同。',
    '- 已为 15 个片型各固定 1 个多轮修订项目规格；真实两轮修订完成 0/15，已验证真实修订轮次 0，模拟分数上涨不获信用。',
    '- 已生成 15 项目、30 轮的 fail-closed 执行批次；当前15项全部阻断、Round 1可执行0项、真实完成仍为0。',
    '- 阻断项包括真实项目ID、初始专业文本包、模型或人工创作授权、修订预算、三类评审者和桌读排期；缺任一项不得执行或计数。',
    '',
    '## 本轮验证',
    '',
    ...validationLines,
    '',
    '## 外部阻塞',
    '',
    '- 需要真人编剧/剧本编辑、类型/导演、事实/文化三类评审者。',
    '- 需要用户自有、公共领域或已授权的专业结构基准。',
    '- 需要真实模型运行环境、模型与提示版本、成本和修订次数记录。',
    '- 需要黄金卡来源、授权和真实人工签署。',
  );
  return `${lines.join('\n').trim()}\n`;
}

async function buildAudit(): Promise<{
  matrix: JsonRecord;
  progress: JsonRecord;
  matrixMarkdown: string;
  gapMarkdown: string;
}> {
  process.env.KB_ROOT ||= path.join(repoRoot, 'data');
  const [{ VIDEO_TYPE_CONFIG }, profileModule, materialModule, schemaModule, packageModule] = await Promise.all([
    import('../web/shared/types.js'),
    import('../web/server/src/services/genre-story-profiles.js'),
    import('../web/server/src/services/production-material-pack-service.js'),
    import('../web/shared/schemas.js'),
    import('../web/server/src/services/professional-text-package-service.js'),
  ]);
  const profiles = profileModule.GENRE_STORY_PROFILES;
  const getReturnFields = profileModule.getGenreReturnJsonFields;
  const materialPacks = materialModule.getProductionMaterialPacks();
  const materialByType = new Map(materialPacks.map(pack => [pack.video_type, pack]));
  const sourceTextEntries = await Promise.all(([
    ['shared_types', 'web/shared/types.ts'],
    ['shared_schemas', 'web/shared/schemas.ts'],
    ['story_service', 'web/server/src/services/story-service.ts'],
    ['story_prompt', 'web/server/src/services/story-generation-prompt.ts'],
    ['blueprint_service', 'web/server/src/services/story-blueprint-service.ts'],
    ['genre_quality', 'web/server/src/services/genre-quality-service.ts'],
    ['quality_workflow', 'web/server/src/services/quality-workflow-service.ts'],
    ['story_repair', 'web/server/src/services/story-repair-service.ts'],
    ['quality_repair', 'web/server/src/services/quality-repair-service.ts'],
    ['professional_contracts', 'web/server/src/services/professional-text-contracts.ts'],
    ['professional_package_service', 'web/server/src/services/professional-text-package-service.ts'],
    ['professional_pipeline_service', 'web/server/src/services/professional-text-pipeline-service.ts'],
    ['professional_quality_service', 'web/server/src/services/professional-text-quality-service.ts'],
    ['professional_revision_service', 'web/server/src/services/professional-text-revision-service.ts'],
    ['historical_pipeline_service', 'web/server/src/services/professional-historical-drama-pipeline-service.ts'],
    ['historical_quality_service', 'web/server/src/services/professional-historical-drama-quality-service.ts'],
    ['historical_revision_service', 'web/server/src/services/professional-historical-drama-revision-service.ts'],
    ['legend_pipeline_service', 'web/server/src/services/professional-legend-story-pipeline-service.ts'],
    ['legend_quality_service', 'web/server/src/services/professional-legend-story-quality-service.ts'],
    ['legend_revision_service', 'web/server/src/services/professional-legend-story-revision-service.ts'],
    ['children_pipeline_service', 'web/server/src/services/professional-children-story-pipeline-service.ts'],
    ['children_quality_service', 'web/server/src/services/professional-children-story-quality-service.ts'],
    ['children_revision_service', 'web/server/src/services/professional-children-story-revision-service.ts'],
    ['comic_pipeline_service', 'web/server/src/services/professional-ai-comic-drama-pipeline-service.ts'],
    ['comic_quality_service', 'web/server/src/services/professional-ai-comic-drama-quality-service.ts'],
    ['comic_revision_service', 'web/server/src/services/professional-ai-comic-drama-revision-service.ts'],
    ['culture_promo_pipeline_service', 'web/server/src/services/professional-culture-promo-pipeline-service.ts'],
    ['culture_promo_quality_service', 'web/server/src/services/professional-culture-promo-quality-service.ts'],
    ['culture_promo_revision_service', 'web/server/src/services/professional-culture-promo-revision-service.ts'],
    ['heritage_promo_pipeline_service', 'web/server/src/services/professional-heritage-promo-pipeline-service.ts'],
    ['heritage_promo_quality_service', 'web/server/src/services/professional-heritage-promo-quality-service.ts'],
    ['heritage_promo_revision_service', 'web/server/src/services/professional-heritage-promo-revision-service.ts'],
    ['city_brand_pipeline_service', 'web/server/src/services/professional-city-brand-promo-pipeline-service.ts'],
    ['city_brand_quality_service', 'web/server/src/services/professional-city-brand-promo-quality-service.ts'],
    ['city_brand_revision_service', 'web/server/src/services/professional-city-brand-promo-revision-service.ts'],
    ['social_short_pipeline_service', 'web/server/src/services/professional-social-short-pipeline-service.ts'],
    ['social_short_quality_service', 'web/server/src/services/professional-social-short-quality-service.ts'],
    ['social_short_revision_service', 'web/server/src/services/professional-social-short-revision-service.ts'],
    ['documentary_short_pipeline_service', 'web/server/src/services/professional-documentary-short-pipeline-service.ts'],
    ['documentary_short_quality_service', 'web/server/src/services/professional-documentary-short-quality-service.ts'],
    ['documentary_short_revision_service', 'web/server/src/services/professional-documentary-short-revision-service.ts'],
    ['explainer_video_pipeline_service', 'web/server/src/services/professional-explainer-video-pipeline-service.ts'],
    ['explainer_video_quality_service', 'web/server/src/services/professional-explainer-video-quality-service.ts'],
    ['explainer_video_revision_service', 'web/server/src/services/professional-explainer-video-revision-service.ts'],
    ['lecture_video_pipeline_service', 'web/server/src/services/professional-lecture-video-pipeline-service.ts'],
    ['lecture_video_quality_service', 'web/server/src/services/professional-lecture-video-quality-service.ts'],
    ['lecture_video_revision_service', 'web/server/src/services/professional-lecture-video-revision-service.ts'],
    ['education_training_pipeline_service', 'web/server/src/services/professional-education-training-pipeline-service.ts'],
    ['education_training_quality_service', 'web/server/src/services/professional-education-training-quality-service.ts'],
    ['education_training_revision_service', 'web/server/src/services/professional-education-training-revision-service.ts'],
    ['scene_short_pipeline_service', 'web/server/src/services/professional-scene-short-pipeline-service.ts'],
    ['scene_short_quality_service', 'web/server/src/services/professional-scene-short-quality-service.ts'],
    ['scene_short_revision_service', 'web/server/src/services/professional-scene-short-revision-service.ts'],
    ['landscape_mood_pipeline_service', 'web/server/src/services/professional-landscape-mood-pipeline-service.ts'],
    ['landscape_mood_quality_service', 'web/server/src/services/professional-landscape-mood-quality-service.ts'],
    ['landscape_mood_revision_service', 'web/server/src/services/professional-landscape-mood-revision-service.ts'],
    ['multi_round_revision_service', 'web/server/src/services/professional-multi-round-revision-service.ts'],
    ['multi_round_revision_execution_service', 'web/server/src/services/professional-multi-round-revision-execution-service.ts'],
    ['multi_round_revision_execution_script', 'scripts/story-agent-multi-round-revision-execution-plan.mts'],
    ['professional_benchmark_service', 'web/server/src/services/professional-benchmark-service.ts'],
    ['professional_benchmark_prompt_service', 'web/server/src/services/professional-benchmark-prompt-service.ts'],
    ['professional_benchmark_run_service', 'web/server/src/services/professional-benchmark-run-service.ts'],
    ['professional_benchmark_bridge_adapter', 'web/server/src/services/professional-benchmark-bridge-adapter.ts'],
    ['professional_benchmark_artifact_service', 'web/server/src/services/professional-benchmark-artifact-service.ts'],
    ['professional_benchmark_review_service', 'web/server/src/services/professional-benchmark-review-service.ts'],
    ['professional_benchmark_post_initial_service', 'web/server/src/services/professional-benchmark-post-initial-service.ts'],
    ['professional_benchmark_finalization_service', 'web/server/src/services/professional-benchmark-finalization-service.ts'],
    ['professional_benchmark_strict_bridge', 'web/server/scripts/professional-character-benchmark-bridge.mjs'],
    ['professional_benchmark_controlled_runner', 'scripts/story-agent-character-benchmark-runner.mts'],
    ['professional_benchmark_lifecycle_plan', 'scripts/story-agent-character-benchmark-lifecycle-plan.mts'],
  ] as const).map(async ([key, relativePath]) => [
    key,
    await fs.readFile(path.join(repoRoot, relativePath), 'utf8'),
  ] as const));
  const sourceText = Object.fromEntries(sourceTextEntries) as Record<string, string>;
  const legacyGenerationChainImplemented = containsAll(sourceText.story_service, [
    'buildStoryBlueprint({',
    'attachBlueprintScenes(',
    'full_text',
    'scene_breakdown',
    'gears_segments',
  ]) && containsAll(sourceText.story_prompt, [
    'getGenreStoryProfile(',
    'story_blueprint',
  ]);
  const blueprintSupport = {
    genre_beats: sourceText.shared_types.includes('genre_beats: StoryGenreBeat[]'),
    evidence_boundaries: sourceText.shared_types.includes('evidence_boundaries: EvidenceBoundary[]'),
    character_arcs: sourceText.shared_types.includes('character_arcs: StoryCharacterArcPlan[]'),
    target_duration: sourceText.shared_types.includes('target_duration: SupportedDuration'),
    audience_promise: sourceText.shared_types.includes('audience_promise:'),
    platform_and_budget_assumptions: sourceText.shared_types.includes('budget_assumptions:'),
    relationship_or_information_architecture: sourceText.shared_types.includes('information_architecture:'),
    director_text_plan: sourceText.shared_types.includes('director_text_plan:'),
  };
  const genericQualitySupport = {
    generic_structure_validation: sourceText.genre_quality.includes('validateGenreStoryQuality'),
    outline_coverage: sourceText.quality_workflow.includes('outline_coverage_report'),
    pattern_quality: sourceText.quality_workflow.includes('pattern_quality_report'),
    gears_readiness: sourceText.quality_workflow.includes('gears_readiness_report'),
    audience_text_pollution: sourceText.quality_workflow.includes('audience_text_report'),
  };
  const semanticQualityImplemented = containsAll(sourceText.genre_quality, [
    'hasSemanticSignalEvidence',
    'findMissingRequiredElements',
  ]) && sourceText.quality_workflow.includes('hasSemanticSignalEvidence');
  const genericModelRepairImplemented = sourceText.story_repair.includes('buildStoryRepairPromptPackage');
  const qualityRepairApplyAndDiffImplemented = containsAll(sourceText.quality_repair, [
    'repairStoryWithQualityWorkflow',
    'qualityImproved',
  ]);
  const localAiComicRepairImplemented = containsAll(sourceText.quality_repair, [
    "story.video_type !== 'ai_comic_drama'",
    'local_ai_comic_quality_repair_applied',
  ]);
  const professionalPackageImplemented = containsAll(sourceText.shared_types, [
    'ProfessionalTextPackage',
  ]) && sourceText.shared_schemas.includes('ProfessionalTextPackageSchema')
    && sourceText.professional_contracts.includes('PROFESSIONAL_TEXT_TYPE_CONTRACTS')
    && sourceText.professional_package_service.includes('createProfessionalTextPackageSkeleton');
  const characterStoryPipelineImplemented = containsAll(sourceText.professional_pipeline_service, [
    'buildCharacterStoryProfessionalTextPackage',
    'evaluateCharacterStoryProfessionalText',
    "input.story.video_type !== 'character_story'",
  ]);
  const characterStoryQualityEvaluatorImplemented = containsAll(sourceText.professional_quality_service, [
    'evaluateCharacterStoryProfessionalText',
    'character_goal_missing',
    'choice_missing',
    'cost_missing',
    'relationship_change_missing',
    'dialogue_voice_or_subtext_missing',
    'truth_boundary_missing',
    'professional_passed: false',
  ]);
  const characterStoryRevisionPlannerImplemented = containsAll(sourceText.professional_revision_service, [
    'buildCharacterStoryRevisionPlan',
    'rebuildCharacterStoryDerivedText',
    'model_rewrite_required',
    'human_evidence_required',
    'revision_trace.push',
  ]);
  const historicalDramaPipelineImplemented = containsAll(sourceText.historical_pipeline_service, [
    'buildHistoricalDramaProfessionalTextPackage',
    'evaluateHistoricalDramaProfessionalText',
    "input.story.video_type !== 'historical_drama'",
  ]);
  const historicalDramaQualityEvaluatorImplemented = containsAll(sourceText.historical_quality_service, [
    'evaluateHistoricalDramaProfessionalText',
    'era_or_institutional_pressure_missing',
    'event_causality_missing',
    'role_position_conflict_missing',
    'scene_truth_boundary_missing',
    'professional_passed: false',
  ]);
  const historicalDramaRevisionPlannerImplemented = containsAll(sourceText.historical_revision_service, [
    'buildHistoricalDramaRevisionPlan',
    'rebuildHistoricalDramaDerivedText',
    'model_rewrite_required',
    'human_evidence_required',
    'revision_trace.push',
  ]);
  const legendStoryPipelineImplemented = containsAll(sourceText.legend_pipeline_service, [
    'buildLegendStoryProfessionalTextPackage',
    'evaluateLegendStoryProfessionalText',
    "input.story.video_type !== 'legend_story'",
  ]);
  const legendStoryQualityEvaluatorImplemented = containsAll(sourceText.legend_quality_service, [
    'evaluateLegendStoryProfessionalText',
    'version_boundary_missing',
    'supernatural_function_missing',
    'motif_repetition_missing',
    'oral_rhythm_missing',
    'professional_passed: false',
  ]);
  const legendStoryRevisionPlannerImplemented = containsAll(sourceText.legend_revision_service, [
    'buildLegendStoryRevisionPlan',
    'rebuildLegendStoryDerivedText',
    'model_rewrite_required',
    'human_evidence_required',
    'revision_trace.push',
  ]);
  const childrenStoryPipelineImplemented = containsAll(sourceText.children_pipeline_service, [
    'buildChildrenStoryProfessionalTextPackage',
    'evaluateChildrenStoryProfessionalText',
    "input.story.video_type !== 'children_story'",
  ]);
  const childrenStoryQualityEvaluatorImplemented = containsAll(sourceText.children_quality_service, [
    'evaluateChildrenStoryProfessionalText',
    'age_and_language_missing',
    'gentle_conflict_missing',
    'child_safety_boundary_missing',
    'parent_or_teacher_prompt_missing',
    'professional_passed: false',
  ]);
  const childrenStoryRevisionPlannerImplemented = containsAll(sourceText.children_revision_service, [
    'buildChildrenStoryRevisionPlan',
    'rebuildChildrenStoryDerivedText',
    'model_rewrite_required',
    'human_evidence_required',
    'revision_trace.push',
  ]);
  const comicPipelineImplemented = containsAll(sourceText.comic_pipeline_service, ['buildAiComicDramaProfessionalTextPackage', 'evaluateAiComicDramaProfessionalText', "input.story.video_type !== 'ai_comic_drama'"]);
  const comicQualityEvaluatorImplemented = containsAll(sourceText.comic_quality_service, ['evaluateAiComicDramaProfessionalText', 'panelability_missing', 'expression_reaction_missing', 'asset_continuity_missing', 'professional_passed: false']);
  const comicRevisionPlannerImplemented = containsAll(sourceText.comic_revision_service, ['buildAiComicDramaRevisionPlan', 'rebuildAiComicDramaDerivedText', 'model_rewrite_required', 'human_evidence_required', 'revision_trace.push']);
  const culturePromoPipelineImplemented = containsAll(sourceText.culture_promo_pipeline_service, ['buildCulturePromoProfessionalTextPackage', 'evaluateCulturePromoProfessionalText', "input.story.video_type !== 'culture_promo'"]);
  const culturePromoQualityImplemented = containsAll(sourceText.culture_promo_quality_service, ['evaluateCulturePromoProfessionalText', 'proposition_missing', 'proof_point_missing', 'information_curve_missing', 'professional_passed: false']);
  const culturePromoRevisionImplemented = containsAll(sourceText.culture_promo_revision_service, ['buildCulturePromoRevisionPlan', 'rebuildCulturePromoDerivedText', 'model_rewrite_required', 'human_evidence_required', 'revision_trace.push']);
  const heritagePromoPipelineImplemented=containsAll(sourceText.heritage_promo_pipeline_service,['buildHeritagePromoProfessionalTextPackage','evaluateHeritagePromoProfessionalText']);
  const heritagePromoQualityImplemented=containsAll(sourceText.heritage_promo_quality_service,['evaluateHeritagePromoProfessionalText','process_missing','authorization_missing','professional_passed:false']);
  const heritagePromoRevisionImplemented=containsAll(sourceText.heritage_promo_revision_service,['buildHeritagePromoRevisionPlan','rebuildHeritagePromoDerivedText','human_evidence_required']);
  const cityBrandPipelineImplemented=containsAll(sourceText.city_brand_pipeline_service,['buildCityBrandPromoProfessionalTextPackage','evaluateCityBrandPromoProfessionalText']);
  const cityBrandQualityImplemented=containsAll(sourceText.city_brand_quality_service,['evaluateCityBrandPromoProfessionalText','route_missing','geographic_boundary_missing','professional_passed:false']);
  const cityBrandRevisionImplemented=containsAll(sourceText.city_brand_revision_service,['buildCityBrandPromoRevisionPlan','rebuildCityBrandPromoDerivedText','human_evidence_required']);
  const socialShortPipelineImplemented=containsAll(sourceText.social_short_pipeline_service,['buildSocialShortProfessionalTextPackage','evaluateSocialShortProfessionalText']);
  const socialShortQualityImplemented=containsAll(sourceText.social_short_quality_service,['evaluateSocialShortProfessionalText','hook_fact_boundary_missing','channel_division_missing','professional_passed: false']);
  const socialShortRevisionImplemented=containsAll(sourceText.social_short_revision_service,['buildSocialShortRevisionPlan','rebuildSocialShortDerivedText','human_evidence_required']);
  const documentaryShortPipelineImplemented=containsAll(sourceText.documentary_short_pipeline_service,['buildDocumentaryShortProfessionalTextPackage','evaluateDocumentaryShortProfessionalText']);
  const documentaryShortQualityImplemented=containsAll(sourceText.documentary_short_quality_service,['evaluateDocumentaryShortProfessionalText','interview_consent_missing','source_trace_missing','professional_passed: false']);
  const documentaryShortRevisionImplemented=containsAll(sourceText.documentary_short_revision_service,['buildDocumentaryShortRevisionPlan','rebuildDocumentaryShortDerivedText','human_evidence_required']);
  const explainerVideoPipelineImplemented=containsAll(sourceText.explainer_video_pipeline_service,['buildExplainerVideoProfessionalTextPackage','evaluateExplainerVideoProfessionalText']);
  const explainerVideoQualityImplemented=containsAll(sourceText.explainer_video_quality_service,['evaluateExplainerVideoProfessionalText','one_concept_per_segment_missing','visual_metaphor_boundary_missing','professional_passed: false']);
  const explainerVideoRevisionImplemented=containsAll(sourceText.explainer_video_revision_service,['buildExplainerVideoRevisionPlan','rebuildExplainerVideoDerivedText','human_evidence_required']);
  const lectureVideoPipelineImplemented=containsAll(sourceText.lecture_video_pipeline_service,['buildLectureVideoProfessionalTextPackage','evaluateLectureVideoProfessionalText']);
  const lectureVideoQualityImplemented=containsAll(sourceText.lecture_video_quality_service,['evaluateLectureVideoProfessionalText','counterargument_missing','institutional_wording_unconfirmed','professional_passed: false']);
  const lectureVideoRevisionImplemented=containsAll(sourceText.lecture_video_revision_service,['buildLectureVideoRevisionPlan','rebuildLectureVideoDerivedText','human_evidence_required']);
  const educationTrainingPipelineImplemented=containsAll(sourceText.education_training_pipeline_service,['buildEducationTrainingProfessionalTextPackage','evaluateEducationTrainingProfessionalText']);
  const educationTrainingQualityImplemented=containsAll(sourceText.education_training_quality_service,['evaluateEducationTrainingProfessionalText','objective_practice_assessment_misaligned','institutional_or_safety_boundary_missing','professional_passed: false']);
  const educationTrainingRevisionImplemented=containsAll(sourceText.education_training_revision_service,['buildEducationTrainingRevisionPlan','rebuildEducationTrainingDerivedText','human_evidence_required']);
  const sceneShortPipelineImplemented=containsAll(sourceText.scene_short_pipeline_service,['buildSceneShortProfessionalTextPackage','evaluateSceneShortProfessionalText']);
  const sceneShortQualityImplemented=containsAll(sourceText.scene_short_quality_service,['evaluateSceneShortProfessionalText','space_not_protagonist','sound_route_missing','professional_passed: false']);
  const sceneShortRevisionImplemented=containsAll(sourceText.scene_short_revision_service,['buildSceneShortRevisionPlan','rebuildSceneShortDerivedText','human_evidence_required']);
  const landscapeMoodPipelineImplemented=containsAll(sourceText.landscape_mood_pipeline_service,['buildLandscapeMoodProfessionalTextPackage','evaluateLandscapeMoodProfessionalText']);
  const landscapeMoodQualityImplemented=containsAll(sourceText.landscape_mood_quality_service,['evaluateLandscapeMoodProfessionalText','without_narration_unreadable','narration_too_dense','professional_passed: false']);
  const landscapeMoodRevisionImplemented=containsAll(sourceText.landscape_mood_revision_service,['buildLandscapeMoodRevisionPlan','rebuildLandscapeMoodDerivedText','human_evidence_required']);
  const multiRoundRevisionContractImplemented=containsAll(sourceText.multi_round_revision_service,['buildProfessionalCoverageActionSet','importProfessionalTableReadFeedback','recordProfessionalRevisionRound','validateProfessionalMultiRoundRevisionLedger','stale_derived_sections','fixture_or_simulation_credit_forbidden','stage6_exit_candidate','professional_passed: false']);
  const multiRoundRevisionExecutionImplemented=containsAll(sourceText.multi_round_revision_execution_service,['buildMultiRoundRevisionExecutionManifest','validateMultiRoundRevisionExecutionManifest','real_project_id_missing','initial_professional_text_package_missing','prepared_or_ready_counts_as_completed_revision: false'])&&containsAll(sourceText.multi_round_revision_execution_script,['all-format-stage6-iteration2-execution-manifest.json','blocked_project_count !== 15','ready_for_round_1_project_count !== 0']);
  const characterStoryBenchmarkPreflightImplemented = containsAll(sourceText.professional_benchmark_service, [
    'buildCharacterStoryBenchmarkExecutionManifest',
    'inspectBenchmarkStrictReadiness',
    'validateRealModelBenchmarkRunEvidence',
    'fixture_or_simulation_counts_as_real_run: false',
  ]);
  const characterBenchmarkPromptContractImplemented = containsAll(
    sourceText.professional_benchmark_prompt_service,
    [
      'buildCharacterStoryProfessionalBenchmarkPrompt',
      'CHARACTER_STORY_EVIDENCE_OUTPUT_CONTRACT',
      'professional_passed: false',
    ],
  );
  const characterStrictSceneOutputContractImplemented = containsAll(
    sourceText.professional_benchmark_prompt_service,
    [
      'CHARACTER_STORY_SCENE_OUTPUT_CONTRACT',
      'coordinator_must_not_infer_or_backfill_missing_scene_fields',
      'fictionalized_elements',
    ],
  ) && containsAll(sourceText.professional_benchmark_artifact_service, [
    'source_entries',
    'factual_basis',
    'fictionalized_elements',
  ]);
  const characterStrictBridgeImplemented = containsAll(sourceText.professional_benchmark_strict_bridge, [
    'PROFESSIONAL_BENCHMARK_PAID_EXECUTION_AUTHORIZED',
    'PROFESSIONAL_BENCHMARK_AUTHORIZATION_REFERENCE',
    'CLI SHA-256 does not match the approved trust anchor',
    'contains reserved field',
    'provenance_complete',
  ]) && containsAll(sourceText.professional_benchmark_bridge_adapter, [
    'runProfessionalBenchmarkBridgeAdapter',
    'Independent operator authorization',
    'operator-approved trust anchor',
    'expected_bridge_anchor',
    'frozen run ledger anchor',
    'cli_sha256',
    'operator_authorization',
  ]);
  const characterBenchmarkRunLedgerImplemented = containsAll(sourceText.professional_benchmark_run_service, [
    'prepareProfessionalBenchmarkRun',
    'authorizeProfessionalBenchmarkRun',
    'professional-benchmark-run-ledger/v3',
    'credit_eligible: false',
    'professional_passed: false',
  ]);
  const characterArtifactContractImplemented = containsAll(sourceText.professional_benchmark_artifact_service, [
    'validateProfessionalBenchmarkArtifacts',
    'initial_run',
    'professional_completion',
    'human_blind_review',
    'bridge_envelope_sha256',
    'final_quality_report',
  ]);
  const characterBlindReviewThresholdImplemented = containsAll(
    sourceText.professional_benchmark_review_service,
    [
      'evaluateProfessionalBlindReviewBundle',
      'review_threshold_passed',
      'professional_passed: false',
      "getProfessionalTextTypeContract('character_story')",
    ],
  );
  const characterControlledRunnerImplemented = containsAll(
    sourceText.professional_benchmark_controlled_runner,
    [
      'buildControlledCharacterBenchmarkPlan',
      'executeControlledCharacterBenchmarkBatch',
      'operator_env_authorization_required: true',
      'fixture_or_simulation_counts_as_professional_pass: false',
    ],
  );
  const characterPostInitialCoordinatorImplemented = containsAll(
    sourceText.professional_benchmark_post_initial_service,
    [
      'coordinateProfessionalBenchmarkPostInitial',
      'post_initial_opt_in_required',
      'initial_story_invalid',
      'credit_eligible: false',
      'professional_passed: false',
    ],
  );
  const characterFinalizationCandidateGateImplemented = containsAll(
    sourceText.professional_benchmark_finalization_service,
    [
      'evaluateProfessionalBenchmarkFinalization',
      'eligible_for_signed_release',
      'signed_release_record_missing',
      'professional-benchmark-finalization-input/v2',
      'Ed25519',
      'trusted_verifier_policy_invalid_or_missing',
      'final_quality_report_sha256',
      'professional_passed: false',
    ],
  );
  const characterLifecyclePlanImplemented = containsAll(
    sourceText.professional_benchmark_lifecycle_plan,
    [
      'buildCharacterBenchmarkLifecyclePlan',
      'validateCharacterBenchmarkLifecyclePlan',
      'awaiting_verified_initial_run',
      'final_quality_report',
      'signed_release_required_for_professional_pass: true',
    ],
  );
  const characterBenchmarkRegistry = await readJson(path.join(
    repoRoot,
    'data',
    'professional-benchmarks',
    'character-story-iteration3-benchmark-specs.json',
  ));
  const characterBenchmarkSummary = characterBenchmarkRegistry.summary as JsonRecord;
  const characterFixedProjectSpecCount = Number(characterBenchmarkSummary.fixed_project_spec_count ?? 0);
  const characterFixedRealModelProjectCount = Number(characterBenchmarkSummary.fixed_real_model_project_count ?? 0);
  const characterFailureFixtureCount = Number(characterBenchmarkSummary.failure_fixture_count ?? 0);
  const characterHumanBlindReviewPassCount = Number(characterBenchmarkSummary.human_blind_review_pass_count ?? 0);
  const historicalBenchmarkRegistry = await readJson(path.join(
    repoRoot,
    'data',
    'professional-benchmarks',
    'historical-drama-iteration4-benchmark-specs.json',
  ));
  const historicalBenchmarkSummary = historicalBenchmarkRegistry.summary as JsonRecord;
  const historicalFixedProjectSpecCount = Number(historicalBenchmarkSummary.fixed_project_spec_count ?? 0);
  const historicalFixedRealModelProjectCount = Number(
    historicalBenchmarkSummary.fixed_real_model_project_count ?? 0,
  );
  const historicalFailureFixtureCount = Number(historicalBenchmarkSummary.failure_fixture_count ?? 0);
  const historicalHumanBlindReviewPassCount = Number(
    historicalBenchmarkSummary.human_blind_review_pass_count ?? 0,
  );
  const legendBenchmarkRegistry = await readJson(path.join(
    repoRoot,
    'data',
    'professional-benchmarks',
    'legend-story-iteration5-benchmark-specs.json',
  ));
  const legendBenchmarkSummary = legendBenchmarkRegistry.summary as JsonRecord;
  const legendFixedProjectSpecCount = Number(legendBenchmarkSummary.fixed_project_spec_count ?? 0);
  const legendFixedRealModelProjectCount = Number(legendBenchmarkSummary.fixed_real_model_project_count ?? 0);
  const legendFailureFixtureCount = Number(legendBenchmarkSummary.failure_fixture_count ?? 0);
  const legendHumanBlindReviewPassCount = Number(legendBenchmarkSummary.human_blind_review_pass_count ?? 0);
  const childrenBenchmarkRegistry = await readJson(path.join(
    repoRoot,
    'data',
    'professional-benchmarks',
    'children-story-iteration6-benchmark-specs.json',
  ));
  const childrenBenchmarkSummary = childrenBenchmarkRegistry.summary as JsonRecord;
  const childrenFixedProjectSpecCount = Number(childrenBenchmarkSummary.fixed_project_spec_count ?? 0);
  const childrenFixedRealModelProjectCount = Number(childrenBenchmarkSummary.fixed_real_model_project_count ?? 0);
  const childrenFailureFixtureCount = Number(childrenBenchmarkSummary.failure_fixture_count ?? 0);
  const childrenHumanBlindReviewPassCount = Number(childrenBenchmarkSummary.human_blind_review_pass_count ?? 0);
  const comicBenchmarkRegistry = await readJson(path.join(repoRoot, 'data', 'professional-benchmarks', 'ai-comic-drama-iteration7-benchmark-specs.json'));
  const comicBenchmarkSummary = comicBenchmarkRegistry.summary as JsonRecord;
  const comicFixedProjectSpecCount = Number(comicBenchmarkSummary.fixed_project_spec_count ?? 0);
  const comicFixedRealModelProjectCount = Number(comicBenchmarkSummary.fixed_real_model_project_count ?? 0);
  const comicFailureFixtureCount = Number(comicBenchmarkSummary.failure_fixture_count ?? 0);
  const comicHumanBlindReviewPassCount = Number(comicBenchmarkSummary.human_blind_review_pass_count ?? 0);
  const culturePromoRegistry = await readJson(path.join(repoRoot, 'data', 'professional-benchmarks', 'culture-promo-stage3-iteration1-benchmark-specs.json'));
  const culturePromoSummary = culturePromoRegistry.summary as JsonRecord;
  const culturePromoFixedProjectSpecCount = Number(culturePromoSummary.fixed_project_spec_count ?? 0);
  const culturePromoFixedRealModelProjectCount = Number(culturePromoSummary.fixed_real_model_project_count ?? 0);
  const culturePromoFailureFixtureCount = Number(culturePromoSummary.failure_fixture_count ?? 0);
  const culturePromoHumanBlindReviewPassCount = Number(culturePromoSummary.human_blind_review_pass_count ?? 0);
  const heritagePromoRegistry=await readJson(path.join(repoRoot,'data','professional-benchmarks','heritage-promo-stage3-iteration2-benchmark-specs.json'));const heritagePromoSummary=heritagePromoRegistry.summary as JsonRecord;const heritagePromoFixedProjectSpecCount=Number(heritagePromoSummary.fixed_project_spec_count??0);const heritagePromoFailureFixtureCount=Number(heritagePromoSummary.failure_fixture_count??0);
  const cityBrandRegistry=await readJson(path.join(repoRoot,'data','professional-benchmarks','city-brand-promo-stage3-iteration3-benchmark-specs.json'));const cityBrandSummary=cityBrandRegistry.summary as JsonRecord;const cityBrandFixedProjectSpecCount=Number(cityBrandSummary.fixed_project_spec_count??0);const cityBrandFailureFixtureCount=Number(cityBrandSummary.failure_fixture_count??0);
  const socialShortRegistry=await readJson(path.join(repoRoot,'data','professional-benchmarks','social-short-stage3-iteration4-benchmark-specs.json'));const socialShortSummary=socialShortRegistry.summary as JsonRecord;const socialShortFixedProjectSpecCount=Number(socialShortSummary.fixed_project_spec_count??0);const socialShortFailureFixtureCount=Number(socialShortSummary.failure_fixture_count??0);
  const documentaryShortRegistry=await readJson(path.join(repoRoot,'data','professional-benchmarks','documentary-short-stage4-iteration1-benchmark-specs.json'));const documentaryShortSummary=documentaryShortRegistry.summary as JsonRecord;const documentaryShortFixedProjectSpecCount=Number(documentaryShortSummary.fixed_project_spec_count??0);const documentaryShortFailureFixtureCount=Number(documentaryShortSummary.failure_fixture_count??0);
  const explainerVideoRegistry=await readJson(path.join(repoRoot,'data','professional-benchmarks','explainer-video-stage4-iteration2-benchmark-specs.json'));const explainerVideoSummary=explainerVideoRegistry.summary as JsonRecord;const explainerVideoFixedProjectSpecCount=Number(explainerVideoSummary.fixed_project_spec_count??0);const explainerVideoFailureFixtureCount=Number(explainerVideoSummary.failure_fixture_count??0);
  const lectureVideoRegistry=await readJson(path.join(repoRoot,'data','professional-benchmarks','lecture-video-stage4-iteration3-benchmark-specs.json'));const lectureVideoSummary=lectureVideoRegistry.summary as JsonRecord;const lectureVideoFixedProjectSpecCount=Number(lectureVideoSummary.fixed_project_spec_count??0);const lectureVideoFailureFixtureCount=Number(lectureVideoSummary.failure_fixture_count??0);
  const educationTrainingRegistry=await readJson(path.join(repoRoot,'data','professional-benchmarks','education-training-stage4-iteration4-benchmark-specs.json'));const educationTrainingSummary=educationTrainingRegistry.summary as JsonRecord;const educationTrainingFixedProjectSpecCount=Number(educationTrainingSummary.fixed_project_spec_count??0);const educationTrainingFailureFixtureCount=Number(educationTrainingSummary.failure_fixture_count??0);
  const sceneShortRegistry=await readJson(path.join(repoRoot,'data','professional-benchmarks','scene-short-stage5-iteration1-benchmark-specs.json'));const sceneShortSummary=sceneShortRegistry.summary as JsonRecord;const sceneShortFixedProjectSpecCount=Number(sceneShortSummary.fixed_project_spec_count??0);const sceneShortFailureFixtureCount=Number(sceneShortSummary.failure_fixture_count??0);
  const landscapeMoodRegistry=await readJson(path.join(repoRoot,'data','professional-benchmarks','landscape-mood-stage5-iteration2-benchmark-specs.json'));const landscapeMoodSummary=landscapeMoodRegistry.summary as JsonRecord;const landscapeMoodFixedProjectSpecCount=Number(landscapeMoodSummary.fixed_project_spec_count??0);const landscapeMoodFailureFixtureCount=Number(landscapeMoodSummary.failure_fixture_count??0);
  const multiRoundRevisionRegistry=await readJson(path.join(repoRoot,'data','professional-benchmarks','all-format-stage6-iteration1-multi-round-revision-specs.json'));const multiRoundRevisionSummary=multiRoundRevisionRegistry.summary as JsonRecord;const multiRoundRevisionProjectSpecCount=Number(multiRoundRevisionSummary.fixed_multi_round_revision_project_spec_count??0);const completedTwoRoundVerifiedProjectCount=Number(multiRoundRevisionSummary.completed_two_round_verified_project_count??0);const recordedVerifiedRevisionRoundCount=Number(multiRoundRevisionSummary.recorded_verified_revision_round_count??0);const multiRoundRevisionFailureFixtureCount=Number(multiRoundRevisionSummary.failure_fixture_count??0);
  const multiRoundRevisionExecutionManifest=await readJson(path.join(repoRoot,'data','professional-benchmarks','all-format-stage6-iteration2-execution-manifest.json'));const multiRoundRevisionExecutionSummary=multiRoundRevisionExecutionManifest.summary as JsonRecord;const plannedRevisionRoundCount=Number(multiRoundRevisionExecutionSummary.planned_revision_round_count??0);const blockedRevisionProjectCount=Number(multiRoundRevisionExecutionSummary.blocked_project_count??0);const readyForRound1ProjectCount=Number(multiRoundRevisionExecutionSummary.ready_for_round_1_project_count??0);
  const characterExecutionManifest = await readJson(path.join(
    repoRoot,
    'data',
    'professional-benchmarks',
    'character-story-iteration3-execution-manifest.json',
  ));
  const characterExecutionSummary = characterExecutionManifest.summary as JsonRecord;
  const characterStrictReadiness = characterExecutionManifest.strict_readiness as JsonRecord;
  const characterSourceSnapshotReadyCount = Number(characterExecutionSummary.source_snapshot_ready_count ?? 0);
  const characterStrictTechnicalReadyCount = Number(characterExecutionSummary.strict_technical_ready_count ?? 0);
  const characterBridgeActivationPlanReadyCount = Number(
    characterExecutionSummary.strict_bridge_anchor_ready_count ?? 0,
  );
  const characterRealModelExecutionReadyCount = Number(characterExecutionSummary.real_model_execution_ready_count ?? 0);
  const characterControlledRunPlan = await readJson(path.join(
    repoRoot,
    'data',
    'professional-benchmarks',
    'character-story-iteration3-controlled-run-plan.json',
  ));
  const characterControlledRunSummary = characterControlledRunPlan.summary as JsonRecord;
  const characterControlledRunPlanProjectCount = Number(
    characterControlledRunSummary.fixed_project_spec_count ?? 0,
  );
  const characterPreparedRunLedgerCount = Number(
    characterControlledRunSummary.prepared_run_ledger_count ?? 0,
  );
  const characterControlledBlockedRunCount = Number(
    characterControlledRunSummary.blocked_run_count ?? 0,
  );
  const characterModelInvocationCount = Number(
    characterControlledRunSummary.model_invocation_count ?? 0,
  );
  const characterRealModelCompletedCount = Number(
    characterControlledRunSummary.real_model_completed_count ?? 0,
  );
  const characterLifecyclePlan = await readJson(path.join(
    repoRoot,
    'data',
    'professional-benchmarks',
    'character-story-iteration3-lifecycle-plan.json',
  ));
  const characterLifecycleSummary = characterLifecyclePlan.summary as JsonRecord;
  const characterLifecyclePlanProjectCount = Number(
    characterLifecycleSummary.fixed_project_spec_count ?? 0,
  );
  const characterLifecycleAwaitingInitialCount = Number(
    characterLifecycleSummary.awaiting_verified_initial_run_count ?? 0,
  );
  const characterFinalizationCandidateCount = Number(
    characterLifecycleSummary.finalization_candidate_count ?? 0,
  );
  const characterSignedReleaseCount = Number(characterLifecycleSummary.signed_release_count ?? 0);
  const goldenIndex = await readJson(path.join(repoRoot, 'data', 'production-cards', 'golden-card-unified-index.json'));
  const goldenCounts = isRecord(goldenIndex.counts) ? goldenIndex.counts : {};
  const goldenByType = isRecord(goldenCounts.by_video_type) ? goldenCounts.by_video_type : {};
  const reviewIndex = Array.isArray(goldenIndex.review_index) ? goldenIndex.review_index.filter(isRecord) : [];
  const humanApprovedByType = new Map<VideoType, number>();
  for (const item of reviewIndex) {
    const videoType = item.video_type as VideoType;
    const reviewStatus = String(item.review_status ?? '');
    if (/^(?:human_)?(?:approved|passed)(?:_by_human)?$/.test(reviewStatus)
      && !/pending|simulation|fixture/.test(reviewStatus)) {
      humanApprovedByType.set(videoType, (humanApprovedByType.get(videoType) ?? 0) + 1);
    }
  }

  const fixtureByType = new Map<VideoType, number>();
  const fixtureFiles = (await listFiles(path.join(repoRoot, 'data', 'production-cards'), '.json'))
    .filter(filePath => filePath.endsWith('-golden-regression-fixtures.json'));
  for (const filePath of fixtureFiles) {
    const fileName = path.basename(filePath);
    const videoType = VIDEO_TYPES.find(item => fileName.startsWith(item.replaceAll('_', '-')));
    if (!videoType) continue;
    const fixtureFile = await readJson(filePath);
    const fixtureCount = Array.isArray(fixtureFile.fixtures) ? fixtureFile.fixtures.length : 0;
    fixtureByType.set(videoType, fixtureCount);
  }

  const [remediationQueue, externalHandoff, archiveManifest, relinkTriage] = await Promise.all([
    readJson(path.join(repoRoot, 'data', 'reports', 'story-agent-monitor-remediation-queue-20260710.json')),
    readJson(path.join(
      repoRoot,
      'data',
      'reports',
      'story-agent-governance-external-callback-baseline-20260710.json',
    )),
    readJson(path.join(repoRoot, 'data', 'reports', 'story-agent-soft-archive-manifest-20260710.json')),
    readJson(path.join(repoRoot, 'data', 'reports', 'story-agent-relink-triage-20260710.json')),
  ]);
  const remediationSummary = remediationQueue.summary as JsonRecord;
  const externalHandoffProject = externalHandoff.project as JsonRecord;
  const archiveSummary = archiveManifest.summary as JsonRecord;
  const archivePolicy = archiveManifest.policy as JsonRecord;
  const relinkSummary = relinkTriage.summary as JsonRecord;

  const testFiles = [
    ...await listFiles(path.join(repoRoot, 'web', 'server', 'src', '__tests__'), '.test.ts'),
    ...await listFiles(path.join(repoRoot, 'mcp-server', '__tests__'), '.test.ts'),
  ];
  const testContents = await Promise.all(testFiles.map(async filePath => ({
    path: path.relative(repoRoot, filePath),
    content: await fs.readFile(filePath, 'utf8'),
  })));
  const storyStudio = await fs.readFile(path.join(repoRoot, 'web', 'client', 'src', 'views', 'StoryStudio.vue'), 'utf8');
  const storyResult = await fs.readFile(path.join(repoRoot, 'web', 'client', 'src', 'components', 'StoryResult.vue'), 'utf8');
  const projectDetail = await fs.readFile(path.join(repoRoot, 'web', 'client', 'src', 'views', 'ProjectDetail.vue'), 'utf8');
  const allTypesSelectable = storyStudio.includes('Object.values(VIDEO_TYPE_CONFIG)');
  const genericResultSupported = storyResult.includes('VIDEO_TYPE_CONFIG');
  const genericQualityRepairUi = projectDetail.includes('qualityRepairPromptResult')
    && projectDetail.includes('repair_action_items');
  const rows = VIDEO_TYPES.map(videoType => {
    const profile = profiles[videoType];
    const expectation = PROFESSIONAL_EXPECTATIONS[videoType];
    const materialPack = materialByType.get(videoType);
    const explicitQualityEvidence = semanticQualityImplemented
      ? EXPLICIT_SEMANTIC_QUALITY_EVIDENCE[videoType] ?? []
      : [];
    const testReferences = testContents
      .filter(item => item.content.includes(`'${videoType}'`) || item.content.includes(`\"${videoType}\"`))
      .map(item => item.path);
    const goldenDraftCount = Number(goldenByType[videoType] ?? 0);
    const humanApprovedCount = humanApprovedByType.get(videoType) ?? 0;
    const fixtureCount = fixtureByType.get(videoType) ?? 0;
    const legacyContractComplete = profileContractComplete(profile);
    const professionalContract = profile.professional_text_contract;
    const professionalContractImplemented = professionalPackageImplemented
      && schemaModule.ProfessionalTextTypeContractSchema.safeParse(professionalContract).success
      && professionalContract.video_type === videoType
      && professionalContract.required_package_fields.length === PROFESSIONAL_UNIFORM_FIELDS.length;
    const skeleton = professionalContractImplemented
      ? packageModule.createProfessionalTextPackageSkeleton({
          video_type: videoType,
          package_id: `audit-${videoType}`,
          now: '2026-07-10T16:00:00.000Z',
        })
      : undefined;
    const professionalSkeletonSchemaPassed = Boolean(
      skeleton && schemaModule.ProfessionalTextPackageSchema.safeParse(skeleton).success,
    );
    const isCharacterStory = videoType === 'character_story';
    const isHistoricalDrama = videoType === 'historical_drama';
    const isLegendStory = videoType === 'legend_story';
    const isChildrenStory = videoType === 'children_story';
    const isAiComicDrama = videoType === 'ai_comic_drama';
    const isCulturePromo = videoType === 'culture_promo';
    const isHeritagePromo = videoType === 'heritage_promo';
    const isCityBrandPromo = videoType === 'city_brand_promo';
    const isSocialShort = videoType === 'social_short';
    const isDocumentaryShort = videoType === 'documentary_short';
    const isExplainerVideo = videoType === 'explainer_video';
    const isLectureVideo = videoType === 'lecture_video';
    const isEducationTraining = videoType === 'education_training';
    const isSceneShort = videoType === 'scene_short';
    const isLandscapeMood = videoType === 'landscape_mood';
    const verticalPipelineImplemented = (isCharacterStory && characterStoryPipelineImplemented)
      || (isHistoricalDrama && historicalDramaPipelineImplemented)
      || (isLegendStory && legendStoryPipelineImplemented)
      || (isChildrenStory && childrenStoryPipelineImplemented)
      || (isAiComicDrama && comicPipelineImplemented)
      || (isCulturePromo && culturePromoPipelineImplemented)||(isHeritagePromo&&heritagePromoPipelineImplemented)||(isCityBrandPromo&&cityBrandPipelineImplemented)||(isSocialShort&&socialShortPipelineImplemented)||(isDocumentaryShort&&documentaryShortPipelineImplemented)||(isExplainerVideo&&explainerVideoPipelineImplemented)||(isLectureVideo&&lectureVideoPipelineImplemented)||(isEducationTraining&&educationTrainingPipelineImplemented)||(isSceneShort&&sceneShortPipelineImplemented)||(isLandscapeMood&&landscapeMoodPipelineImplemented);
    const professionalQualityEvaluatorImplemented = (isCharacterStory
      && characterStoryQualityEvaluatorImplemented)
      || (isHistoricalDrama && historicalDramaQualityEvaluatorImplemented)
      || (isLegendStory && legendStoryQualityEvaluatorImplemented)
      || (isChildrenStory && childrenStoryQualityEvaluatorImplemented)
      || (isAiComicDrama && comicQualityEvaluatorImplemented)
      || (isCulturePromo && culturePromoQualityImplemented)||(isHeritagePromo&&heritagePromoQualityImplemented)||(isCityBrandPromo&&cityBrandQualityImplemented)||(isSocialShort&&socialShortQualityImplemented)||(isDocumentaryShort&&documentaryShortQualityImplemented)||(isExplainerVideo&&explainerVideoQualityImplemented)||(isLectureVideo&&lectureVideoQualityImplemented)||(isEducationTraining&&educationTrainingQualityImplemented)||(isSceneShort&&sceneShortQualityImplemented)||(isLandscapeMood&&landscapeMoodQualityImplemented);
    const professionalRevisionPlannerImplemented = (isCharacterStory
      && characterStoryRevisionPlannerImplemented)
      || (isHistoricalDrama && historicalDramaRevisionPlannerImplemented)
      || (isLegendStory && legendStoryRevisionPlannerImplemented)
      || (isChildrenStory && childrenStoryRevisionPlannerImplemented)
      || (isAiComicDrama && comicRevisionPlannerImplemented)
      || (isCulturePromo && culturePromoRevisionImplemented)||(isHeritagePromo&&heritagePromoRevisionImplemented)||(isCityBrandPromo&&cityBrandRevisionImplemented)||(isSocialShort&&socialShortRevisionImplemented)||(isDocumentaryShort&&documentaryShortRevisionImplemented)||(isExplainerVideo&&explainerVideoRevisionImplemented)||(isLectureVideo&&lectureVideoRevisionImplemented)||(isEducationTraining&&educationTrainingRevisionImplemented)||(isSceneShort&&sceneShortRevisionImplemented)||(isLandscapeMood&&landscapeMoodRevisionImplemented);
    const fixedProjectSpecCount = isCharacterStory
      ? characterFixedProjectSpecCount
      : isHistoricalDrama
        ? historicalFixedProjectSpecCount
        : isLegendStory
          ? legendFixedProjectSpecCount
          : isChildrenStory
            ? childrenFixedProjectSpecCount
            : isAiComicDrama ? comicFixedProjectSpecCount : isCulturePromo ? culturePromoFixedProjectSpecCount : isHeritagePromo?heritagePromoFixedProjectSpecCount:isCityBrandPromo?cityBrandFixedProjectSpecCount:isSocialShort?socialShortFixedProjectSpecCount:isDocumentaryShort?documentaryShortFixedProjectSpecCount:isExplainerVideo?explainerVideoFixedProjectSpecCount:isLectureVideo?lectureVideoFixedProjectSpecCount:isEducationTraining?educationTrainingFixedProjectSpecCount:isSceneShort?sceneShortFixedProjectSpecCount:isLandscapeMood?landscapeMoodFixedProjectSpecCount:0;
    const failureFixtureCount = isCharacterStory
      ? characterFailureFixtureCount
      : isHistoricalDrama
        ? historicalFailureFixtureCount
        : isLegendStory
          ? legendFailureFixtureCount
          : isChildrenStory
            ? childrenFailureFixtureCount
            : isAiComicDrama ? comicFailureFixtureCount : isCulturePromo ? culturePromoFailureFixtureCount : isHeritagePromo?heritagePromoFailureFixtureCount:isCityBrandPromo?cityBrandFailureFixtureCount:isSocialShort?socialShortFailureFixtureCount:isDocumentaryShort?documentaryShortFailureFixtureCount:isExplainerVideo?explainerVideoFailureFixtureCount:isLectureVideo?lectureVideoFailureFixtureCount:isEducationTraining?educationTrainingFailureFixtureCount:isSceneShort?sceneShortFailureFixtureCount:isLandscapeMood?landscapeMoodFailureFixtureCount:0;
    const fixedRealModelProjectCount = isCharacterStory
      ? characterFixedRealModelProjectCount
      : isHistoricalDrama
        ? historicalFixedRealModelProjectCount
        : isLegendStory
          ? legendFixedRealModelProjectCount
          : isChildrenStory
            ? childrenFixedRealModelProjectCount
            : isAiComicDrama ? comicFixedRealModelProjectCount : isCulturePromo ? culturePromoFixedRealModelProjectCount : 0;
    const humanBlindReviewPassCount = isCharacterStory
      ? characterHumanBlindReviewPassCount
      : isHistoricalDrama
        ? historicalHumanBlindReviewPassCount
        : isLegendStory
          ? legendHumanBlindReviewPassCount
          : isChildrenStory
            ? childrenHumanBlindReviewPassCount
            : isAiComicDrama ? comicHumanBlindReviewPassCount : isCulturePromo ? culturePromoHumanBlindReviewPassCount : 0;
    const gaps = [
      professionalContractImplemented && professionalSkeletonSchemaPassed
        ? ''
        : '缺少 ProfessionalTextPackage 片型必填映射、schema 或合法骨架',
      '缺少真实模型固定项目和初稿到终稿修订证据',
      '缺少真人盲评与三角色签署',
      humanApprovedCount === 0 ? '缺少人工通过黄金卡' : '',
      materialPack ? '' : '缺少 ProductionMaterialPack',
      professionalContractImplemented && professionalQualityEvaluatorImplemented
        ? '十维评分和硬门槛已接入候选文本评估，但缺真实模型文本、原创性判断和真人盲评证据'
        : professionalContractImplemented
          ? '十维权重与硬门槛合同已结构化，但尚未接入片型专业评分执行和真实文本证据'
        : explicitQualityEvidence.length > 0
          ? '专业十维权重与硬门槛尚未结构化'
          : '缺少片型专属语义质量证据、专业权重与硬门槛',
      professionalRevisionPlannerImplemented
        ? '定向修订计划和陈旧派生文本重建已实现，但缺真实模型初稿到终稿的质量增量证明'
        : videoType === 'ai_comic_drama'
          ? '本地修复存在但没有真实模型/真人评审增量证明'
          : '缺少片型确定性修复与质量增量证明',
    ].filter(Boolean);

    return {
      video_type: videoType,
      label: VIDEO_TYPE_CONFIG[videoType].label,
      group: VIDEO_TYPE_CONFIG[videoType].group,
      line: expectation.line,
      professional_required_deliverables: expectation.required_deliverables,
      professional_exclusive_quality_gate: expectation.exclusive_quality_gate,
      legacy_profile_contract_complete: legacyContractComplete,
      legacy_profile_contract: {
        narrative_promise: profile.narrative_promise,
        text_shape: profile.text_shape,
        framework: profile.framework,
        must_include: profile.must_include,
        required_fields: profile.required_fields,
        quality_rules: profile.quality_rules,
        repair_guidance: profile.repair_guidance,
        truth_rules: profile.truth_rules,
        adaptation_rules: profile.adaptation_rules,
        scene_template_count: profile.dramatic_structure.scene_templates.length,
      },
      legacy_output_contract_fields: getReturnFields(videoType),
      legacy_structural_generation_supported: legacyContractComplete && legacyGenerationChainImplemented,
      legacy_generation_chain_evidence: {
        genre_profile_contract: legacyContractComplete,
        story_service_chain: legacyGenerationChainImplemented,
        source_files: [
          'web/server/src/services/story-service.ts',
          'web/server/src/services/story-generation-prompt.ts',
          'web/server/src/services/story-blueprint-service.ts',
        ],
      },
      story_blueprint_support: blueprintSupport,
      quality_support: {
        status: professionalQualityEvaluatorImplemented
          ? 'professional_candidate_evaluator'
          : explicitQualityEvidence.length > 0
            ? 'partial_semantic'
            : 'generic_only',
        profile_quality_rule_count: profile.quality_rules.length,
        ...genericQualitySupport,
        explicit_semantic_evidence: explicitQualityEvidence,
        professional_dimension_weights_implemented: professionalContractImplemented,
        structured_hard_gates_implemented: professionalContractImplemented,
        professional_quality_evaluator_implemented: professionalQualityEvaluatorImplemented,
        machine_evaluated_professional_dimensions: professionalQualityEvaluatorImplemented
          ? PROFESSIONAL_QUALITY_DIMENSIONS
          : [],
        missing_professional_dimensions: professionalQualityEvaluatorImplemented
          ? ['originality_and_distinctiveness_human_validation']
          : PROFESSIONAL_QUALITY_DIMENSIONS,
      },
      repair_support: {
        status: professionalRevisionPlannerImplemented
          ? 'professional_targeted_revision_plan'
          : videoType === 'ai_comic_drama'
            ? 'generic_plus_local_ai_comic'
            : 'generic_model_only',
        profile_repair_guidance_count: profile.repair_guidance.length,
        generic_model_rewrite_prompt: genericModelRepairImplemented,
        quality_repair_apply_and_diff: qualityRepairApplyAndDiffImplemented,
        deterministic_local_repair: videoType === 'ai_comic_drama' && localAiComicRepairImplemented,
        professional_revision_plan_implemented: professionalRevisionPlannerImplemented,
        deterministic_derived_text_rebuild_implemented: professionalRevisionPlannerImplemented,
        professional_revision_trace: professionalRevisionPlannerImplemented,
        real_model_quality_improvement_proof_count: 0,
      },
      material_and_benchmark_support: {
        production_material_pack_present: Boolean(materialPack),
        production_material_sample_entry_count: materialPack?.sample_entries.length ?? 0,
        golden_card_draft_count: goldenDraftCount,
        human_approved_golden_card_count: humanApprovedCount,
        fixture_regression_count: fixtureCount,
        fixture_counted_as_professional_pass: false,
        fixed_project_spec_count: fixedProjectSpecCount,
        failure_fixture_count: failureFixtureCount,
        benchmark_preflight_implemented: isCharacterStory && characterStoryBenchmarkPreflightImplemented,
        benchmark_source_snapshot_ready_count: isCharacterStory ? characterSourceSnapshotReadyCount : 0,
        bridge_activation_plan_ready_count: isCharacterStory ? characterBridgeActivationPlanReadyCount : 0,
        strict_technical_ready_count: isCharacterStory ? characterStrictTechnicalReadyCount : 0,
        real_model_execution_ready_count: isCharacterStory ? characterRealModelExecutionReadyCount : 0,
        strict_technical_readiness: isCharacterStory
          && characterStrictReadiness.technical_ready === true,
        real_model_adapter_configured: false,
        real_model_execution_authorized: false,
        benchmark_prompt_contract_implemented: isCharacterStory
          && characterBenchmarkPromptContractImplemented,
        strict_scene_output_contract_implemented: isCharacterStory
          && characterStrictSceneOutputContractImplemented,
        strict_real_model_bridge_implemented: isCharacterStory && characterStrictBridgeImplemented,
        benchmark_run_ledger_implemented: isCharacterStory && characterBenchmarkRunLedgerImplemented,
        artifact_integrity_contract_implemented: isCharacterStory && characterArtifactContractImplemented,
        blind_review_threshold_contract_implemented: isCharacterStory
          && characterBlindReviewThresholdImplemented,
        controlled_runner_implemented: isCharacterStory && characterControlledRunnerImplemented,
        controlled_run_plan_project_count: isCharacterStory ? characterControlledRunPlanProjectCount : 0,
        prepared_run_ledger_count: isCharacterStory ? characterPreparedRunLedgerCount : 0,
        controlled_blocked_run_count: isCharacterStory ? characterControlledBlockedRunCount : 0,
        post_initial_coordinator_implemented: isCharacterStory
          && characterPostInitialCoordinatorImplemented,
        finalization_candidate_gate_implemented: isCharacterStory
          && characterFinalizationCandidateGateImplemented,
        lifecycle_plan_implemented: isCharacterStory && characterLifecyclePlanImplemented,
        lifecycle_plan_project_count: isCharacterStory ? characterLifecyclePlanProjectCount : 0,
        lifecycle_awaiting_verified_initial_count: isCharacterStory
          ? characterLifecycleAwaitingInitialCount
          : 0,
        finalization_candidate_count: isCharacterStory ? characterFinalizationCandidateCount : 0,
        signed_release_count: isCharacterStory ? characterSignedReleaseCount : 0,
        model_invocation_count: isCharacterStory ? characterModelInvocationCount : 0,
        real_model_completed_count: isCharacterStory ? characterRealModelCompletedCount : 0,
        fixed_real_model_regression_project_count: fixedRealModelProjectCount,
        human_blind_review_pass_project_count: humanBlindReviewPassCount,
      },
      test_and_ui_support: {
        legacy_test_reference_file_count: testReferences.length,
        legacy_test_reference_files: testReferences,
        video_type_selectable_in_story_studio: allTypesSelectable,
        generic_story_result_supported: genericResultSupported,
        generic_quality_repair_ui_supported: genericQualityRepairUi,
        professional_workflow_ui_complete: false,
      },
      professional_uniform_fields_expected: PROFESSIONAL_UNIFORM_FIELDS,
      professional_text_contract: professionalContract,
      professional_text_package_contract_implemented: professionalContractImplemented,
      professional_text_package_skeleton_schema_passed: professionalSkeletonSchemaPassed,
      professional_vertical_pipeline_implemented: verticalPipelineImplemented,
      professional_text_package_passed: false,
      professional_hard_gate_status: professionalContractImplemented
        ? 'failed_missing_professional_output_and_evidence'
        : 'failed_missing_contract_and_evidence',
      professional_gaps: gaps,
    };
  });

  const legacyProfileCount = rows.filter(row => row.legacy_profile_contract_complete).length;
  const legacyGenerationCount = rows.filter(row => row.legacy_structural_generation_supported).length;
  const profileQualityCount = rows.filter(row => row.legacy_profile_contract.quality_rules.length > 0).length;
  const profileRepairCount = rows.filter(row => row.legacy_profile_contract.repair_guidance.length > 0).length;
  const professionalContractCount = rows.filter(row => row.professional_text_package_contract_implemented).length;
  const professionalSkeletonSchemaPassCount = rows.filter(row => row.professional_text_package_skeleton_schema_passed).length;
  const professionalWeightedQualityCount = rows.filter(row =>
    row.quality_support.professional_dimension_weights_implemented
    && row.quality_support.structured_hard_gates_implemented
  ).length;
  const goldenCardDraftCount = rows.reduce((sum, row) => sum + row.material_and_benchmark_support.golden_card_draft_count, 0);
  const humanApprovedGoldenCount = rows.reduce((sum, row) => sum + row.material_and_benchmark_support.human_approved_golden_card_count, 0);
  const fixtureCount = rows.reduce((sum, row) => sum + row.material_and_benchmark_support.fixture_regression_count, 0);
  const professionalVerticalPipelineCount = rows.filter(row => row.professional_vertical_pipeline_implemented).length;
  const professionalQualityEvaluatorCount = rows.filter(row =>
    row.quality_support.professional_quality_evaluator_implemented
  ).length;
  const professionalRevisionPlannerCount = rows.filter(row =>
    row.repair_support.professional_revision_plan_implemented
  ).length;
  const generatedAt = new Date().toISOString();
  const summary = {
    video_type_coverage_count: rows.length,
    legacy_profile_contract_count: legacyProfileCount,
    legacy_structural_generation_count: legacyGenerationCount,
    profile_quality_rule_count: profileQualityCount,
    profile_repair_guidance_count: profileRepairCount,
    professional_text_package_contract_count: professionalContractCount,
    professional_text_package_skeleton_schema_pass_count: professionalSkeletonSchemaPassCount,
    professional_weighted_quality_hard_gate_count: professionalWeightedQualityCount,
    explicit_semantic_quality_type_count: rows.filter(row => row.quality_support.explicit_semantic_evidence.length > 0).length,
    professional_text_package_pass_count: 0,
    production_material_pack_count: materialPacks.length,
    golden_card_video_type_count: rows.filter(row => row.material_and_benchmark_support.golden_card_draft_count > 0).length,
    golden_card_draft_count: goldenCardDraftCount,
    human_approved_golden_card_count: humanApprovedGoldenCount,
    fixture_regression_video_type_count: rows.filter(row => row.material_and_benchmark_support.fixture_regression_count > 0).length,
    fixture_regression_count: fixtureCount,
    professional_vertical_pipeline_type_count: professionalVerticalPipelineCount,
    professional_quality_evaluator_type_count: professionalQualityEvaluatorCount,
    professional_revision_planner_type_count: professionalRevisionPlannerCount,
    fixed_project_spec_count: characterFixedProjectSpecCount,
    failure_fixture_count: characterFailureFixtureCount,
    historical_drama_fixed_project_spec_count: historicalFixedProjectSpecCount,
    historical_drama_failure_fixture_count: historicalFailureFixtureCount,
    legend_story_fixed_project_spec_count: legendFixedProjectSpecCount,
    legend_story_failure_fixture_count: legendFailureFixtureCount,
    children_story_fixed_project_spec_count: childrenFixedProjectSpecCount,
    children_story_failure_fixture_count: childrenFailureFixtureCount,
    ai_comic_drama_fixed_project_spec_count: comicFixedProjectSpecCount,
    ai_comic_drama_failure_fixture_count: comicFailureFixtureCount,
    culture_promo_fixed_project_spec_count: culturePromoFixedProjectSpecCount,
    culture_promo_failure_fixture_count: culturePromoFailureFixtureCount,
    heritage_promo_fixed_project_spec_count:heritagePromoFixedProjectSpecCount,
    heritage_promo_failure_fixture_count:heritagePromoFailureFixtureCount,
    city_brand_promo_fixed_project_spec_count:cityBrandFixedProjectSpecCount,
    city_brand_promo_failure_fixture_count:cityBrandFailureFixtureCount,
    social_short_fixed_project_spec_count:socialShortFixedProjectSpecCount,
    social_short_failure_fixture_count:socialShortFailureFixtureCount,
    documentary_short_fixed_project_spec_count:documentaryShortFixedProjectSpecCount,
    documentary_short_failure_fixture_count:documentaryShortFailureFixtureCount,
    explainer_video_fixed_project_spec_count:explainerVideoFixedProjectSpecCount,
    explainer_video_failure_fixture_count:explainerVideoFailureFixtureCount,
    lecture_video_fixed_project_spec_count:lectureVideoFixedProjectSpecCount,
    lecture_video_failure_fixture_count:lectureVideoFailureFixtureCount,
    education_training_fixed_project_spec_count:educationTrainingFixedProjectSpecCount,
    education_training_failure_fixture_count:educationTrainingFailureFixtureCount,
    scene_short_fixed_project_spec_count:sceneShortFixedProjectSpecCount,
    scene_short_failure_fixture_count:sceneShortFailureFixtureCount,
    landscape_mood_fixed_project_spec_count:landscapeMoodFixedProjectSpecCount,
    landscape_mood_failure_fixture_count:landscapeMoodFailureFixtureCount,
    fixed_project_spec_total_count: characterFixedProjectSpecCount
      + historicalFixedProjectSpecCount
      + legendFixedProjectSpecCount
      + childrenFixedProjectSpecCount
      + comicFixedProjectSpecCount
      + culturePromoFixedProjectSpecCount+heritagePromoFixedProjectSpecCount+cityBrandFixedProjectSpecCount+socialShortFixedProjectSpecCount+documentaryShortFixedProjectSpecCount+explainerVideoFixedProjectSpecCount+lectureVideoFixedProjectSpecCount+educationTrainingFixedProjectSpecCount+sceneShortFixedProjectSpecCount+landscapeMoodFixedProjectSpecCount,
    failure_fixture_total_count: characterFailureFixtureCount
      + historicalFailureFixtureCount
      + legendFailureFixtureCount
      + childrenFailureFixtureCount
      + comicFailureFixtureCount
      + culturePromoFailureFixtureCount+heritagePromoFailureFixtureCount+cityBrandFailureFixtureCount+socialShortFailureFixtureCount+documentaryShortFailureFixtureCount+explainerVideoFailureFixtureCount+lectureVideoFailureFixtureCount+educationTrainingFailureFixtureCount+sceneShortFailureFixtureCount+landscapeMoodFailureFixtureCount,
    benchmark_preflight_type_count: characterStoryBenchmarkPreflightImplemented ? 1 : 0,
    benchmark_source_snapshot_ready_count: characterSourceSnapshotReadyCount,
    bridge_activation_plan_ready_count: characterBridgeActivationPlanReadyCount,
    strict_technical_ready_count: characterStrictTechnicalReadyCount,
    real_model_execution_ready_count: characterRealModelExecutionReadyCount,
    benchmark_prompt_contract_type_count: characterBenchmarkPromptContractImplemented ? 1 : 0,
    strict_scene_output_contract_type_count: characterStrictSceneOutputContractImplemented ? 1 : 0,
    strict_real_model_bridge_type_count: characterStrictBridgeImplemented ? 1 : 0,
    benchmark_run_ledger_type_count: characterBenchmarkRunLedgerImplemented ? 1 : 0,
    artifact_integrity_contract_type_count: characterArtifactContractImplemented ? 1 : 0,
    blind_review_threshold_contract_type_count: characterBlindReviewThresholdImplemented ? 1 : 0,
    controlled_runner_type_count: characterControlledRunnerImplemented ? 1 : 0,
    controlled_run_plan_project_count: characterControlledRunPlanProjectCount,
    prepared_run_ledger_count: characterPreparedRunLedgerCount,
    controlled_blocked_run_count: characterControlledBlockedRunCount,
    post_initial_coordinator_type_count: characterPostInitialCoordinatorImplemented ? 1 : 0,
    finalization_candidate_gate_type_count: characterFinalizationCandidateGateImplemented ? 1 : 0,
    lifecycle_plan_type_count: characterLifecyclePlanImplemented ? 1 : 0,
    lifecycle_plan_project_count: characterLifecyclePlanProjectCount,
    lifecycle_awaiting_verified_initial_count: characterLifecycleAwaitingInitialCount,
    finalization_candidate_count: characterFinalizationCandidateCount,
    signed_release_count: characterSignedReleaseCount,
    model_invocation_count: characterModelInvocationCount,
    real_model_completed_count: characterRealModelCompletedCount,
    fixed_real_model_regression_project_count: 0,
    human_blind_review_pass_project_count: 0,
    professional_capability_hard_gate_failure_type_count: rows.filter(row => !row.professional_text_package_passed).length,
    evaluated_professional_output_count: 0,
    evaluated_output_hard_gate_failure_count: 0,
    multi_round_revision_contract_implemented: multiRoundRevisionContractImplemented,
    multi_round_revision_project_spec_count: multiRoundRevisionProjectSpecCount,
    completed_two_round_verified_project_count: completedTwoRoundVerifiedProjectCount,
    recorded_verified_revision_round_count: recordedVerifiedRevisionRoundCount,
    multi_round_revision_failure_fixture_count: multiRoundRevisionFailureFixtureCount,
    multi_round_revision_execution_implemented: multiRoundRevisionExecutionImplemented,
    planned_revision_round_count: plannedRevisionRoundCount,
    blocked_revision_project_count: blockedRevisionProjectCount,
    ready_for_round_1_project_count: readyForRound1ProjectCount,
  };
  const iteration2Complete = professionalContractCount === 15
    && professionalSkeletonSchemaPassCount === 15
    && professionalWeightedQualityCount === 15;
  const iteration3ImplementationReady = iteration2Complete
    && professionalVerticalPipelineCount >= 1
    && professionalQualityEvaluatorCount >= 1
    && professionalRevisionPlannerCount >= 1
    && characterFixedProjectSpecCount === 5
    && characterFailureFixtureCount >= 3
    && characterStoryBenchmarkPreflightImplemented
    && characterSourceSnapshotReadyCount === 5
    && characterBridgeActivationPlanReadyCount === 5
    && characterStrictTechnicalReadyCount === 5
    && characterBenchmarkPromptContractImplemented
    && characterStrictSceneOutputContractImplemented
    && characterStrictBridgeImplemented
    && characterBenchmarkRunLedgerImplemented
    && characterArtifactContractImplemented
    && characterBlindReviewThresholdImplemented
    && characterControlledRunnerImplemented
    && characterControlledRunPlanProjectCount === 5
    && characterPreparedRunLedgerCount === 5
    && characterControlledBlockedRunCount === 5
    && characterPostInitialCoordinatorImplemented
    && characterFinalizationCandidateGateImplemented
    && characterLifecyclePlanImplemented
    && characterLifecyclePlanProjectCount === 5
    && characterLifecycleAwaitingInitialCount === 5
    && characterFinalizationCandidateCount === 0
    && characterSignedReleaseCount === 0
    && characterModelInvocationCount === 0
    && characterRealModelCompletedCount === 0;
  const iteration4ImplementationReady = iteration3ImplementationReady
    && professionalVerticalPipelineCount >= 2
    && professionalQualityEvaluatorCount >= 2
    && professionalRevisionPlannerCount >= 2
    && historicalDramaPipelineImplemented
    && historicalDramaQualityEvaluatorImplemented
    && historicalDramaRevisionPlannerImplemented
    && historicalFixedProjectSpecCount === 5
    && historicalFailureFixtureCount >= 3
    && historicalFixedRealModelProjectCount === 0
    && historicalHumanBlindReviewPassCount === 0;
  const iteration5ImplementationReady = iteration4ImplementationReady
    && professionalVerticalPipelineCount >= 3
    && professionalQualityEvaluatorCount >= 3
    && professionalRevisionPlannerCount >= 3
    && legendStoryPipelineImplemented
    && legendStoryQualityEvaluatorImplemented
    && legendStoryRevisionPlannerImplemented
    && legendFixedProjectSpecCount === 5
    && legendFailureFixtureCount >= 3
    && legendFixedRealModelProjectCount === 0
    && legendHumanBlindReviewPassCount === 0;
  const iteration6ImplementationReady = iteration5ImplementationReady
    && professionalVerticalPipelineCount >= 4
    && professionalQualityEvaluatorCount >= 4
    && professionalRevisionPlannerCount >= 4
    && childrenStoryPipelineImplemented
    && childrenStoryQualityEvaluatorImplemented
    && childrenStoryRevisionPlannerImplemented
    && childrenFixedProjectSpecCount === 5
    && childrenFailureFixtureCount >= 3
    && childrenFixedRealModelProjectCount === 0
    && childrenHumanBlindReviewPassCount === 0;
  const iteration7ImplementationReady = iteration6ImplementationReady
    && professionalVerticalPipelineCount >= 5
    && professionalQualityEvaluatorCount >= 5
    && professionalRevisionPlannerCount >= 5
    && comicPipelineImplemented && comicQualityEvaluatorImplemented && comicRevisionPlannerImplemented
    && comicFixedProjectSpecCount === 5 && comicFailureFixtureCount >= 3
    && comicFixedRealModelProjectCount === 0 && comicHumanBlindReviewPassCount === 0;
  const stage3Iteration1Ready = iteration7ImplementationReady
    && professionalVerticalPipelineCount >= 6 && professionalQualityEvaluatorCount >= 6 && professionalRevisionPlannerCount >= 6
    && culturePromoPipelineImplemented && culturePromoQualityImplemented && culturePromoRevisionImplemented
    && culturePromoFixedProjectSpecCount === 5 && culturePromoFailureFixtureCount >= 3
    && culturePromoFixedRealModelProjectCount === 0 && culturePromoHumanBlindReviewPassCount === 0;
  const stage3Iteration2Ready=stage3Iteration1Ready&&professionalVerticalPipelineCount>=7&&professionalQualityEvaluatorCount>=7&&professionalRevisionPlannerCount>=7&&heritagePromoPipelineImplemented&&heritagePromoQualityImplemented&&heritagePromoRevisionImplemented&&heritagePromoFixedProjectSpecCount===5&&heritagePromoFailureFixtureCount>=3;
  const stage3Iteration3Ready=stage3Iteration2Ready&&professionalVerticalPipelineCount>=8&&professionalQualityEvaluatorCount>=8&&professionalRevisionPlannerCount>=8&&cityBrandPipelineImplemented&&cityBrandQualityImplemented&&cityBrandRevisionImplemented&&cityBrandFixedProjectSpecCount===5&&cityBrandFailureFixtureCount>=3;
  const stage3Iteration4Ready=stage3Iteration3Ready&&professionalVerticalPipelineCount>=9&&professionalQualityEvaluatorCount>=9&&professionalRevisionPlannerCount>=9&&socialShortPipelineImplemented&&socialShortQualityImplemented&&socialShortRevisionImplemented&&socialShortFixedProjectSpecCount===5&&socialShortFailureFixtureCount>=3;
  const stage4Iteration1Ready=stage3Iteration4Ready&&professionalVerticalPipelineCount>=10&&professionalQualityEvaluatorCount>=10&&professionalRevisionPlannerCount>=10&&documentaryShortPipelineImplemented&&documentaryShortQualityImplemented&&documentaryShortRevisionImplemented&&documentaryShortFixedProjectSpecCount===5&&documentaryShortFailureFixtureCount>=3;
  const stage4Iteration2Ready=stage4Iteration1Ready&&professionalVerticalPipelineCount>=11&&professionalQualityEvaluatorCount>=11&&professionalRevisionPlannerCount>=11&&explainerVideoPipelineImplemented&&explainerVideoQualityImplemented&&explainerVideoRevisionImplemented&&explainerVideoFixedProjectSpecCount===5&&explainerVideoFailureFixtureCount>=3;
  const stage4Iteration3Ready=stage4Iteration2Ready&&professionalVerticalPipelineCount>=12&&professionalQualityEvaluatorCount>=12&&professionalRevisionPlannerCount>=12&&lectureVideoPipelineImplemented&&lectureVideoQualityImplemented&&lectureVideoRevisionImplemented&&lectureVideoFixedProjectSpecCount===5&&lectureVideoFailureFixtureCount>=3;
  const stage4Iteration4Ready=stage4Iteration3Ready&&professionalVerticalPipelineCount>=13&&professionalQualityEvaluatorCount>=13&&professionalRevisionPlannerCount>=13&&educationTrainingPipelineImplemented&&educationTrainingQualityImplemented&&educationTrainingRevisionImplemented&&educationTrainingFixedProjectSpecCount===5&&educationTrainingFailureFixtureCount>=3;
  const stage5Iteration1Ready=stage4Iteration4Ready&&professionalVerticalPipelineCount>=14&&professionalQualityEvaluatorCount>=14&&professionalRevisionPlannerCount>=14&&sceneShortPipelineImplemented&&sceneShortQualityImplemented&&sceneShortRevisionImplemented&&sceneShortFixedProjectSpecCount===5&&sceneShortFailureFixtureCount>=3;
  const stage5Iteration2Ready=stage5Iteration1Ready&&professionalVerticalPipelineCount===15&&professionalQualityEvaluatorCount===15&&professionalRevisionPlannerCount===15&&landscapeMoodPipelineImplemented&&landscapeMoodQualityImplemented&&landscapeMoodRevisionImplemented&&landscapeMoodFixedProjectSpecCount===5&&landscapeMoodFailureFixtureCount>=3;
  const stage6Iteration1Ready=stage5Iteration2Ready&&multiRoundRevisionContractImplemented&&multiRoundRevisionProjectSpecCount===15&&completedTwoRoundVerifiedProjectCount===0&&recordedVerifiedRevisionRoundCount===0&&multiRoundRevisionFailureFixtureCount>=3;
  const stage6Iteration2Ready=stage6Iteration1Ready&&multiRoundRevisionExecutionImplemented&&plannedRevisionRoundCount===30&&blockedRevisionProjectCount===15&&readyForRound1ProjectCount===0;
  const matrix: JsonRecord = {
    schema_version: 'story-agent-professional-text-capability-matrix/v1',
    generated_at: generatedAt,
    stage: stage6Iteration2Ready||stage6Iteration1Ready?'stage_6':stage5Iteration2Ready||stage5Iteration1Ready?'stage_5':stage4Iteration4Ready||stage4Iteration3Ready||stage4Iteration2Ready||stage4Iteration1Ready?'stage_4':stage3Iteration4Ready||stage3Iteration3Ready||stage3Iteration2Ready||stage3Iteration1Ready ? 'stage_3' : iteration7ImplementationReady || iteration6ImplementationReady || iteration5ImplementationReady || iteration4ImplementationReady || iteration3ImplementationReady
      ? 'stage_2'
      : iteration2Complete
        ? 'stage_1'
        : 'stage_0',
    iteration: stage6Iteration2Ready?'iteration_2':stage6Iteration1Ready?'iteration_1':stage5Iteration2Ready?'iteration_2':stage5Iteration1Ready?'iteration_1':stage4Iteration4Ready?'iteration_4':stage4Iteration3Ready?'iteration_3':stage4Iteration2Ready?'iteration_2':stage4Iteration1Ready?'iteration_1':stage3Iteration4Ready?'iteration_4':stage3Iteration3Ready?'iteration_3':stage3Iteration2Ready?'iteration_2':stage3Iteration1Ready
      ? 'iteration_1'
      : iteration7ImplementationReady
        ? 'iteration_7'
      : iteration6ImplementationReady
        ? 'iteration_6'
      : iteration5ImplementationReady
        ? 'iteration_5'
      : iteration4ImplementationReady
        ? 'iteration_4'
      : iteration3ImplementationReady
        ? 'iteration_3'
        : iteration2Complete
          ? 'iteration_2'
          : 'iteration_1',
    source_handoff: 'docs/story-agent-all-format-professional-text-creation-handoff-20260710.md',
    source_files: [
      'web/shared/types.ts',
      'web/shared/schemas.ts',
      'web/server/src/services/genre-story-profiles.ts',
      'web/server/src/services/story-blueprint-service.ts',
      'web/server/src/services/story-service.ts',
      'web/server/src/services/story-generation-prompt.ts',
      'web/server/src/services/genre-quality-service.ts',
      'web/server/src/services/quality-workflow-service.ts',
      'web/server/src/services/story-repair-service.ts',
      'web/server/src/services/quality-repair-service.ts',
      'web/server/src/services/professional-text-contracts.ts',
      'web/server/src/services/professional-text-package-service.ts',
      'web/server/src/__tests__/professional-text-package-contract.test.ts',
      'web/server/src/services/professional-text-pipeline-service.ts',
      'web/server/src/services/professional-text-quality-service.ts',
      'web/server/src/services/professional-text-revision-service.ts',
      'web/server/src/services/professional-historical-drama-pipeline-service.ts',
      'web/server/src/services/professional-historical-drama-quality-service.ts',
      'web/server/src/services/professional-historical-drama-revision-service.ts',
      'web/server/src/services/professional-legend-story-pipeline-service.ts',
      'web/server/src/services/professional-legend-story-quality-service.ts',
      'web/server/src/services/professional-legend-story-revision-service.ts',
      'web/server/src/services/professional-children-story-pipeline-service.ts',
      'web/server/src/services/professional-children-story-quality-service.ts',
      'web/server/src/services/professional-children-story-revision-service.ts',
      'web/server/src/services/professional-ai-comic-drama-pipeline-service.ts',
      'web/server/src/services/professional-ai-comic-drama-quality-service.ts',
      'web/server/src/services/professional-ai-comic-drama-revision-service.ts',
      'web/server/src/services/professional-culture-promo-pipeline-service.ts',
      'web/server/src/services/professional-culture-promo-quality-service.ts',
      'web/server/src/services/professional-culture-promo-revision-service.ts',
      'web/server/src/services/professional-heritage-promo-pipeline-service.ts',
      'web/server/src/services/professional-heritage-promo-quality-service.ts',
      'web/server/src/services/professional-heritage-promo-revision-service.ts',
      'web/server/src/services/professional-city-brand-promo-pipeline-service.ts',
      'web/server/src/services/professional-city-brand-promo-quality-service.ts',
      'web/server/src/services/professional-city-brand-promo-revision-service.ts',
      'web/server/src/services/professional-social-short-pipeline-service.ts',
      'web/server/src/services/professional-social-short-quality-service.ts',
      'web/server/src/services/professional-social-short-revision-service.ts',
      'web/server/src/services/professional-documentary-short-pipeline-service.ts',
      'web/server/src/services/professional-documentary-short-quality-service.ts',
      'web/server/src/services/professional-documentary-short-revision-service.ts',
      'web/server/src/services/professional-explainer-video-pipeline-service.ts',
      'web/server/src/services/professional-explainer-video-quality-service.ts',
      'web/server/src/services/professional-explainer-video-revision-service.ts',
      'web/server/src/services/professional-lecture-video-pipeline-service.ts',
      'web/server/src/services/professional-lecture-video-quality-service.ts',
      'web/server/src/services/professional-lecture-video-revision-service.ts',
      'web/server/src/services/professional-education-training-pipeline-service.ts',
      'web/server/src/services/professional-education-training-quality-service.ts',
      'web/server/src/services/professional-education-training-revision-service.ts',
      'web/server/src/services/professional-scene-short-pipeline-service.ts',
      'web/server/src/services/professional-scene-short-quality-service.ts',
      'web/server/src/services/professional-scene-short-revision-service.ts',
      'web/server/src/services/professional-landscape-mood-pipeline-service.ts',
      'web/server/src/services/professional-landscape-mood-quality-service.ts',
      'web/server/src/services/professional-landscape-mood-revision-service.ts',
      'web/server/src/services/professional-multi-round-revision-service.ts',
      'web/server/src/services/professional-multi-round-revision-execution-service.ts',
      'scripts/story-agent-multi-round-revision-execution-plan.mts',
      'web/server/src/services/professional-benchmark-service.ts',
      'web/server/src/services/professional-benchmark-prompt-service.ts',
      'web/server/scripts/professional-character-benchmark-bridge.mjs',
      'web/server/src/services/professional-benchmark-bridge-adapter.ts',
      'web/server/src/services/professional-benchmark-run-service.ts',
      'web/server/src/services/professional-benchmark-artifact-service.ts',
      'web/server/src/services/professional-benchmark-review-service.ts',
      'web/server/src/services/professional-benchmark-post-initial-service.ts',
      'web/server/src/services/professional-benchmark-finalization-service.ts',
      'web/server/src/__tests__/professional-character-story-pipeline.test.ts',
      'web/server/src/__tests__/professional-historical-drama-pipeline.test.ts',
      'web/server/src/__tests__/professional-legend-story-pipeline.test.ts',
      'web/server/src/__tests__/professional-children-story-pipeline.test.ts',
      'web/server/src/__tests__/professional-ai-comic-drama-pipeline.test.ts',
      'web/server/src/__tests__/professional-culture-promo-pipeline.test.ts',
      'web/server/src/__tests__/professional-heritage-promo-pipeline.test.ts',
      'web/server/src/__tests__/professional-city-brand-promo-pipeline.test.ts',
      'web/server/src/__tests__/professional-social-short-pipeline.test.ts',
      'web/server/src/__tests__/professional-documentary-short-pipeline.test.ts',
      'web/server/src/__tests__/professional-explainer-video-pipeline.test.ts',
      'web/server/src/__tests__/professional-lecture-video-pipeline.test.ts',
      'web/server/src/__tests__/professional-education-training-pipeline.test.ts',
      'web/server/src/__tests__/professional-scene-short-pipeline.test.ts',
      'web/server/src/__tests__/professional-landscape-mood-pipeline.test.ts',
      'web/server/src/__tests__/professional-multi-round-revision.test.ts',
      'web/server/src/__tests__/professional-multi-round-revision-execution.test.ts',
      'web/server/src/__tests__/professional-character-story-benchmark.test.ts',
      'data/professional-benchmarks/character-story-iteration3-benchmark-specs.json',
      'data/professional-benchmarks/historical-drama-iteration4-benchmark-specs.json',
      'data/professional-benchmarks/legend-story-iteration5-benchmark-specs.json',
      'data/professional-benchmarks/children-story-iteration6-benchmark-specs.json',
      'data/professional-benchmarks/ai-comic-drama-iteration7-benchmark-specs.json',
      'data/professional-benchmarks/culture-promo-stage3-iteration1-benchmark-specs.json',
      'data/professional-benchmarks/heritage-promo-stage3-iteration2-benchmark-specs.json',
      'data/professional-benchmarks/city-brand-promo-stage3-iteration3-benchmark-specs.json',
      'data/professional-benchmarks/social-short-stage3-iteration4-benchmark-specs.json',
      'data/professional-benchmarks/documentary-short-stage4-iteration1-benchmark-specs.json',
      'data/professional-benchmarks/explainer-video-stage4-iteration2-benchmark-specs.json',
      'data/professional-benchmarks/lecture-video-stage4-iteration3-benchmark-specs.json',
      'data/professional-benchmarks/education-training-stage4-iteration4-benchmark-specs.json',
      'data/professional-benchmarks/scene-short-stage5-iteration1-benchmark-specs.json',
      'data/professional-benchmarks/landscape-mood-stage5-iteration2-benchmark-specs.json',
      'data/professional-benchmarks/all-format-stage6-iteration1-multi-round-revision-specs.json',
      'data/professional-benchmarks/all-format-stage6-iteration2-execution-manifest.json',
      'data/professional-benchmarks/character-story-iteration3-execution-manifest.json',
      'scripts/story-agent-character-benchmark-preflight.ts',
      'scripts/story-agent-character-benchmark-runner.mts',
      'data/professional-benchmarks/character-story-iteration3-controlled-run-plan.json',
      'scripts/story-agent-character-benchmark-lifecycle-plan.mts',
      'data/professional-benchmarks/character-story-iteration3-lifecycle-plan.json',
      'data/production-packs/video-type-material-supplement-packs.json',
      'data/production-cards/golden-card-unified-index.json',
      'web/client/src/views/StoryStudio.vue',
      'web/client/src/components/StoryResult.vue',
      'web/client/src/views/ProjectDetail.vue',
    ],
    audit_policy: {
      changes_generation_behavior: false,
      fixture_or_simulation_counts_as_professional_pass: false,
      pending_human_review_counts_as_approved: false,
      profile_presence_counts_as_professional_package_pass: false,
      benchmark_spec_counts_as_fixed_real_model_project: false,
      controlled_run_plan_counts_as_fixed_real_model_project: false,
      strict_contract_or_integrity_check_counts_as_professional_pass: false,
      blind_review_threshold_without_verified_human_artifacts_counts_as_pass: false,
      finalization_candidate_without_signed_release_counts_as_pass: false,
      strict_technical_readiness_counts_as_real_model_execution: false,
      lifecycle_plan_counts_as_completed_project: false,
      machine_candidate_score_counts_as_professional_pass: false,
    },
    summary,
    video_types: rows,
  };

  const dimensions: ProgressDimension[] = [
    progressDimension({
      dimension_id: 'contracts_and_schema',
      label: '15 类创作合同与 schema',
      weight_percent: 15,
      completed_evidence_units: legacyProfileCount + professionalContractCount,
      total_evidence_units: 30,
      calculation_rule: '每片型 2 单元：现有 GenreStoryProfile 合同 + ProfessionalTextPackage 片型合同/schema。',
      evidence: [
        `legacy_profile_contract=${legacyProfileCount}/15`,
        `professional_package_contract=${professionalContractCount}/15`,
        `professional_skeleton_schema_pass=${professionalSkeletonSchemaPassCount}/15`,
      ],
    }),
    progressDimension({
      dimension_id: 'complete_text_generation',
      label: '15 类完整文本生成',
      weight_percent: 20,
      completed_evidence_units: legacyGenerationCount,
      total_evidence_units: 30,
      calculation_rule: '每片型 2 单元：现有 full_text/scene/gears 主链 + 专业文本包固定项目通过。',
      evidence: [`legacy_structural_generation=${legacyGenerationCount}/15`, 'professional_package_pass=0/15'],
    }),
    progressDimension({
      dimension_id: 'type_quality_and_repair',
      label: '类型专属质量和修复',
      weight_percent: 20,
      completed_evidence_units: profileQualityCount + profileRepairCount + professionalWeightedQualityCount,
      total_evidence_units: 60,
      calculation_rule: '每片型 4 单元：profile 质量规则、profile 修复指导、专业权重/硬门槛、真实模型修订增量证明。',
      evidence: [
        `profile_quality_rules=${profileQualityCount}/15`,
        `profile_repair_guidance=${profileRepairCount}/15`,
        `professional_weighted_quality_and_hard_gates=${professionalWeightedQualityCount}/15`,
        'real_model_revision_improvement_proof=0/15',
      ],
    }),
    progressDimension({
      dimension_id: 'golden_material_and_domain_pack',
      label: '黄金素材与 Domain Pack',
      weight_percent: 15,
      completed_evidence_units: humanApprovedGoldenCount,
      total_evidence_units: 84,
      calculation_rule: '75 张人工通过黄金卡 + 9 个正式晋升候选 Domain Pack；pending/fixture 不计。',
      evidence: [`human_approved_golden_cards=${humanApprovedGoldenCount}/75`, 'promoted_candidate_domain_packs=0/9'],
    }),
    progressDimension({
      dimension_id: 'fixed_benchmark_and_human_blind_review',
      label: '固定评测集和真人盲评',
      weight_percent: 20,
      completed_evidence_units: 0,
      total_evidence_units: 120,
      calculation_rule: '75 个固定真实项目 + 45 个真人盲评通过项目；本地 fixture 不计。',
      evidence: ['fixed_real_model_projects=0/75', 'human_blind_review_pass=0/45', `excluded_fixture_count=${fixtureCount}`],
    }),
    progressDimension({
      dimension_id: 'product_ci_and_real_projects',
      label: '产品化、CI 和真实项目验收',
      weight_percent: 10,
      completed_evidence_units: 0,
      total_evidence_units: 12,
      calculation_rule: '8 个专业流程产品面 + 1 个统一 CI + 3 个真实端到端项目。',
      evidence: ['professional_workflow_product_surfaces=0/8', 'unified_ci=0/1', 'real_end_to_end_projects=0/3'],
    }),
  ];
  const professionalProgress = round(dimensions.reduce((sum, item) => sum + item.earned_percent, 0));
  const progress: JsonRecord = {
    schema_version: 'story-agent-professional-text-creation-progress/v1',
    updated_at: generatedAt,
    scope: 'Story Agent 专业影视文本创作；独立于素材库、产品 MVP 和 GEARS 执行进度',
    current_stage: {
      stage_id: stage6Iteration2Ready||stage6Iteration1Ready?'stage_6':stage5Iteration2Ready||stage5Iteration1Ready?'stage_5':stage4Iteration4Ready||stage4Iteration3Ready||stage4Iteration2Ready||stage4Iteration1Ready?'stage_4':stage3Iteration4Ready||stage3Iteration3Ready||stage3Iteration2Ready||stage3Iteration1Ready ? 'stage_3' : iteration7ImplementationReady || iteration6ImplementationReady || iteration5ImplementationReady || iteration4ImplementationReady || iteration3ImplementationReady
        ? 'stage_2'
        : iteration2Complete
          ? 'stage_1'
          : 'stage_0',
      label: stage6Iteration1Ready?'Coverage、桌读和多轮修订':stage5Iteration1Ready?'空间与意境线升级':stage4Iteration4Ready||stage4Iteration3Ready||stage4Iteration2Ready||stage4Iteration1Ready?'非虚构与知识线升级':stage3Iteration4Ready||stage3Iteration3Ready||stage3Iteration2Ready||stage3Iteration1Ready ? '宣传传播线升级' : iteration7ImplementationReady || iteration6ImplementationReady || iteration5ImplementationReady || iteration4ImplementationReady || iteration3ImplementationReady
        ? '剧情故事线升级'
        : iteration2Complete
          ? '专业创作合同和统一数据结构'
          : '基线与版本检查点',
      iteration_id: stage6Iteration2Ready?'iteration_2':stage6Iteration1Ready?'iteration_1':stage5Iteration2Ready?'iteration_2':stage5Iteration1Ready?'iteration_1':stage4Iteration4Ready?'iteration_4':stage4Iteration3Ready?'iteration_3':stage4Iteration2Ready?'iteration_2':stage4Iteration1Ready?'iteration_1':stage3Iteration4Ready?'iteration_4':stage3Iteration3Ready?'iteration_3':stage3Iteration2Ready?'iteration_2':stage3Iteration1Ready
        ? 'iteration_1'
        : iteration7ImplementationReady
          ? 'iteration_7'
        : iteration6ImplementationReady
          ? 'iteration_6'
        : iteration5ImplementationReady
          ? 'iteration_5'
        : iteration4ImplementationReady
          ? 'iteration_4'
        : iteration3ImplementationReady
          ? 'iteration_3'
          : iteration2Complete
            ? 'iteration_2'
            : 'iteration_1',
      status: stage6Iteration2Ready?'multi_round_revision_execution_batch_prepared_all_15_blocked_external_inputs':stage6Iteration1Ready?'multi_round_revision_contract_ready_15_real_projects_pending':stage5Iteration2Ready?'all_15_video_type_internal_contracts_ready_real_model_and_human_validation_pending':stage5Iteration1Ready?'scene_short_internal_contract_ready_real_location_model_and_human_validation_pending':stage4Iteration4Ready?'education_training_internal_contract_ready_real_model_instructional_and_human_validation_pending':stage4Iteration3Ready?'lecture_video_internal_contract_ready_real_model_wording_and_human_validation_pending':stage4Iteration2Ready?'explainer_video_internal_contract_ready_real_model_subject_and_human_validation_pending':stage4Iteration1Ready?'documentary_short_internal_contract_ready_real_site_model_and_human_validation_pending':stage3Iteration4Ready?'social_short_internal_contract_ready_real_model_and_human_validation_pending':stage3Iteration3Ready?'city_brand_promo_internal_contract_ready_real_model_and_human_validation_pending':stage3Iteration2Ready?'heritage_promo_internal_contract_ready_real_model_and_human_validation_pending':stage3Iteration1Ready
        ? 'culture_promo_internal_contract_ready_real_model_and_human_validation_pending'
        : iteration7ImplementationReady
          ? 'drama_line_internal_contracts_ready_real_model_and_human_validation_pending'
        : iteration6ImplementationReady
          ? 'children_story_internal_contract_ready_real_model_and_human_validation_pending'
        : iteration5ImplementationReady
          ? 'legend_story_internal_contract_ready_real_model_and_human_validation_pending'
        : iteration4ImplementationReady
          ? 'historical_drama_internal_contract_ready_real_model_and_human_validation_pending'
        : iteration3ImplementationReady
          ? 'full_lifecycle_contract_ready_external_model_and_signed_human_validation_pending'
        : iteration2Complete
          ? 'contract_established'
          : 'baseline_established',
    },
    baseline: {
      stage_id: 'stage_0',
      iteration_id: 'iteration_1',
      professional_text_creation_progress_percent: 27.5,
    },
    progress_change: {
      previous_percent: stage6Iteration2Ready||stage6Iteration1Ready||stage5Iteration2Ready||stage5Iteration1Ready||stage4Iteration4Ready||stage4Iteration3Ready||stage4Iteration2Ready||stage4Iteration1Ready||stage3Iteration4Ready||stage3Iteration3Ready||stage3Iteration2Ready||stage3Iteration1Ready || iteration7ImplementationReady || iteration6ImplementationReady || iteration5ImplementationReady || iteration4ImplementationReady || iteration3ImplementationReady
        ? 40
        : iteration2Complete
          ? 27.5
          : null,
      current_percent: professionalProgress,
      label: stage6Iteration2Ready?`Stage 6 Iteration 2 prepared 30 fail-closed revision rounds; all 15 projects remain blocked without external inputs: 40% -> ${professionalProgress}%`:stage6Iteration1Ready?`Stage 6 Iteration 1 multi-round revision contracts advanced without completed real revision rounds or human table-read evidence: 40% -> ${professionalProgress}%`:stage5Iteration2Ready?`Stage 5 Iteration 2 landscape_mood completed all 15 internal contracts without accepted real-location, real-model or human evidence: 40% -> ${professionalProgress}%`:stage5Iteration1Ready?`Stage 5 Iteration 1 scene_short internal contracts advanced without accepted real-location, real-model or human evidence: 40% -> ${professionalProgress}%`:stage4Iteration4Ready?`Stage 4 Iteration 4 education_training internal contracts advanced without accepted real-model, instructional or human evidence: 40% -> ${professionalProgress}%`:stage4Iteration3Ready?`Stage 4 Iteration 3 lecture_video internal contracts advanced without accepted real-model, wording or human evidence: 40% -> ${professionalProgress}%`:stage4Iteration2Ready?`Stage 4 Iteration 2 explainer_video internal contracts advanced without accepted real-model, subject or human evidence: 40% -> ${professionalProgress}%`:stage4Iteration1Ready?`Stage 4 Iteration 1 documentary_short internal contracts advanced without accepted real-site, real-model or human evidence: 40% -> ${professionalProgress}%`:stage3Iteration4Ready?`Stage 3 Iteration 4 social_short internal contracts advanced without accepted real-model or human evidence: 40% -> ${professionalProgress}%`:stage3Iteration3Ready?`Stage 3 Iteration 3 city_brand_promo internal contracts advanced without accepted real-model or human evidence: 40% -> ${professionalProgress}%`:stage3Iteration2Ready?`Stage 3 Iteration 2 heritage_promo internal contracts advanced without accepted real-model or human evidence: 40% -> ${professionalProgress}%`:stage3Iteration1Ready
        ? `Stage 3 Iteration 1 culture_promo internal contracts advanced without accepted real-model or human evidence: 40% -> ${professionalProgress}%`
        : iteration7ImplementationReady
          ? `Iteration 7 ai_comic_drama completed the five-type drama-line internal contracts without accepted real-model or human evidence: 40% -> ${professionalProgress}%`
        : iteration6ImplementationReady
          ? `Iteration 6 children_story internal contracts advanced without accepted real-model or human evidence: 40% -> ${professionalProgress}%`
        : iteration5ImplementationReady
          ? `Iteration 5 legend_story internal contracts advanced without accepted real-model or human evidence: 40% -> ${professionalProgress}%`
        : iteration4ImplementationReady
          ? `Iteration 4 historical_drama internal contracts advanced without accepted real-model or human evidence: 40% -> ${professionalProgress}%`
        : iteration3ImplementationReady
          ? `Iteration 3 controlled execution contracts advanced without new accepted professional evidence: 40% -> ${professionalProgress}%`
        : iteration2Complete
          ? `Stage 1 contract evidence: 27.5% -> ${professionalProgress}%`
          : `baseline established at ${professionalProgress}%`,
    },
    professional_text_creation_progress_percent: professionalProgress,
    dimensions,
    source_artifacts: {
      capability_matrix_json: 'data/reports/story-agent-professional-text-capability-matrix.json',
      capability_matrix_markdown: 'docs/story-agent-professional-text-capability-matrix-20260710.md',
      gap_report: 'docs/story-agent-professional-text-gap-report-20260710.md',
      integrated_execution_plan: 'docs/story-agent-integrated-execution-plan-20260710.md',
      audit_script: 'scripts/story-agent-professional-text-stage0-audit.ts',
      audit_contract_test: 'mcp-server/__tests__/professional-text-stage0-audit.test.ts',
      character_story_benchmark_specs: 'data/professional-benchmarks/character-story-iteration3-benchmark-specs.json',
      character_story_benchmark_execution_manifest: 'data/professional-benchmarks/character-story-iteration3-execution-manifest.json',
      character_story_benchmark_preflight_script: 'scripts/story-agent-character-benchmark-preflight.ts',
      character_story_controlled_runner: 'scripts/story-agent-character-benchmark-runner.mts',
      character_story_controlled_run_plan: 'data/professional-benchmarks/character-story-iteration3-controlled-run-plan.json',
      character_story_lifecycle_plan_script: 'scripts/story-agent-character-benchmark-lifecycle-plan.mts',
      character_story_lifecycle_plan: 'data/professional-benchmarks/character-story-iteration3-lifecycle-plan.json',
      character_story_iteration_report: 'docs/story-agent-character-story-iteration3-implementation-20260711.md',
      historical_drama_benchmark_specs: 'data/professional-benchmarks/historical-drama-iteration4-benchmark-specs.json',
      historical_drama_iteration_report: 'docs/story-agent-historical-drama-iteration4-implementation-20260711.md',
      legend_story_benchmark_specs: 'data/professional-benchmarks/legend-story-iteration5-benchmark-specs.json',
      legend_story_iteration_report: 'docs/story-agent-legend-story-iteration5-implementation-20260711.md',
      children_story_benchmark_specs: 'data/professional-benchmarks/children-story-iteration6-benchmark-specs.json',
      children_story_iteration_report: 'docs/story-agent-children-story-iteration6-implementation-20260711.md',
      ai_comic_drama_benchmark_specs: 'data/professional-benchmarks/ai-comic-drama-iteration7-benchmark-specs.json',
      ai_comic_drama_iteration_report: 'docs/story-agent-ai-comic-drama-iteration7-implementation-20260711.md',
      culture_promo_benchmark_specs: 'data/professional-benchmarks/culture-promo-stage3-iteration1-benchmark-specs.json',
      culture_promo_iteration_report: 'docs/story-agent-culture-promo-stage3-iteration1-implementation-20260711.md',
      heritage_promo_benchmark_specs:'data/professional-benchmarks/heritage-promo-stage3-iteration2-benchmark-specs.json',
      city_brand_promo_benchmark_specs:'data/professional-benchmarks/city-brand-promo-stage3-iteration3-benchmark-specs.json',
      city_brand_promo_iteration_report:'docs/story-agent-city-brand-promo-stage3-iteration3-implementation-20260711.md',
      social_short_benchmark_specs:'data/professional-benchmarks/social-short-stage3-iteration4-benchmark-specs.json',
      social_short_iteration_report:'docs/story-agent-social-short-stage3-iteration4-implementation-20260711.md',
      documentary_short_benchmark_specs:'data/professional-benchmarks/documentary-short-stage4-iteration1-benchmark-specs.json',
      documentary_short_iteration_report:'docs/story-agent-documentary-short-stage4-iteration1-implementation-20260711.md',
      explainer_video_benchmark_specs:'data/professional-benchmarks/explainer-video-stage4-iteration2-benchmark-specs.json',
      explainer_video_iteration_report:'docs/story-agent-explainer-video-stage4-iteration2-implementation-20260711.md',
      lecture_video_benchmark_specs:'data/professional-benchmarks/lecture-video-stage4-iteration3-benchmark-specs.json',
      lecture_video_iteration_report:'docs/story-agent-lecture-video-stage4-iteration3-implementation-20260711.md',
      education_training_benchmark_specs:'data/professional-benchmarks/education-training-stage4-iteration4-benchmark-specs.json',
      education_training_iteration_report:'docs/story-agent-education-training-stage4-iteration4-implementation-20260711.md',
      scene_short_benchmark_specs:'data/professional-benchmarks/scene-short-stage5-iteration1-benchmark-specs.json',
      scene_short_iteration_report:'docs/story-agent-scene-short-stage5-iteration1-implementation-20260711.md',
      landscape_mood_benchmark_specs:'data/professional-benchmarks/landscape-mood-stage5-iteration2-benchmark-specs.json',
      landscape_mood_iteration_report:'docs/story-agent-landscape-mood-stage5-iteration2-implementation-20260711.md',
      multi_round_revision_specs:'data/professional-benchmarks/all-format-stage6-iteration1-multi-round-revision-specs.json',
      multi_round_revision_iteration_report:'docs/story-agent-multi-round-revision-stage6-iteration1-implementation-20260711.md',
      multi_round_revision_execution_manifest:'data/professional-benchmarks/all-format-stage6-iteration2-execution-manifest.json',
      multi_round_revision_execution_report:'docs/story-agent-multi-round-revision-stage6-iteration2-execution-preparation-20260711.md',
    },
    metrics: {
      covered_video_type_count: 15,
      professional_text_package_contract_count: professionalContractCount,
      professional_text_package_skeleton_schema_pass_count: professionalSkeletonSchemaPassCount,
      professional_text_package_pass_count: 0,
      professional_vertical_pipeline_type_count: professionalVerticalPipelineCount,
      professional_quality_evaluator_type_count: professionalQualityEvaluatorCount,
      professional_revision_planner_type_count: professionalRevisionPlannerCount,
      fixed_project_spec_count: characterFixedProjectSpecCount,
      failure_fixture_count: characterFailureFixtureCount,
      historical_drama_fixed_project_spec_count: historicalFixedProjectSpecCount,
      historical_drama_failure_fixture_count: historicalFailureFixtureCount,
      legend_story_fixed_project_spec_count: legendFixedProjectSpecCount,
      legend_story_failure_fixture_count: legendFailureFixtureCount,
      children_story_fixed_project_spec_count: childrenFixedProjectSpecCount,
      children_story_failure_fixture_count: childrenFailureFixtureCount,
      ai_comic_drama_fixed_project_spec_count: comicFixedProjectSpecCount,
      ai_comic_drama_failure_fixture_count: comicFailureFixtureCount,
      culture_promo_fixed_project_spec_count: culturePromoFixedProjectSpecCount,
      culture_promo_failure_fixture_count: culturePromoFailureFixtureCount,
      heritage_promo_fixed_project_spec_count:heritagePromoFixedProjectSpecCount,
      heritage_promo_failure_fixture_count:heritagePromoFailureFixtureCount,
      city_brand_promo_fixed_project_spec_count:cityBrandFixedProjectSpecCount,
      city_brand_promo_failure_fixture_count:cityBrandFailureFixtureCount,
      social_short_fixed_project_spec_count:socialShortFixedProjectSpecCount,
      social_short_failure_fixture_count:socialShortFailureFixtureCount,
      documentary_short_fixed_project_spec_count:documentaryShortFixedProjectSpecCount,
      documentary_short_failure_fixture_count:documentaryShortFailureFixtureCount,
      explainer_video_fixed_project_spec_count:explainerVideoFixedProjectSpecCount,
      explainer_video_failure_fixture_count:explainerVideoFailureFixtureCount,
      lecture_video_fixed_project_spec_count:lectureVideoFixedProjectSpecCount,
      lecture_video_failure_fixture_count:lectureVideoFailureFixtureCount,
      education_training_fixed_project_spec_count:educationTrainingFixedProjectSpecCount,
      education_training_failure_fixture_count:educationTrainingFailureFixtureCount,
      scene_short_fixed_project_spec_count:sceneShortFixedProjectSpecCount,
      scene_short_failure_fixture_count:sceneShortFailureFixtureCount,
      landscape_mood_fixed_project_spec_count:landscapeMoodFixedProjectSpecCount,
      landscape_mood_failure_fixture_count:landscapeMoodFailureFixtureCount,
      fixed_project_spec_total_count: characterFixedProjectSpecCount
        + historicalFixedProjectSpecCount
        + legendFixedProjectSpecCount
        + childrenFixedProjectSpecCount
        + comicFixedProjectSpecCount
        + culturePromoFixedProjectSpecCount+heritagePromoFixedProjectSpecCount+cityBrandFixedProjectSpecCount+socialShortFixedProjectSpecCount+documentaryShortFixedProjectSpecCount+explainerVideoFixedProjectSpecCount+lectureVideoFixedProjectSpecCount+educationTrainingFixedProjectSpecCount+sceneShortFixedProjectSpecCount+landscapeMoodFixedProjectSpecCount,
      failure_fixture_total_count: characterFailureFixtureCount
        + historicalFailureFixtureCount
        + legendFailureFixtureCount
        + childrenFailureFixtureCount
        + comicFailureFixtureCount
        + culturePromoFailureFixtureCount+heritagePromoFailureFixtureCount+cityBrandFailureFixtureCount+socialShortFailureFixtureCount+documentaryShortFailureFixtureCount+explainerVideoFailureFixtureCount+lectureVideoFailureFixtureCount+educationTrainingFailureFixtureCount+sceneShortFailureFixtureCount+landscapeMoodFailureFixtureCount,
      benchmark_preflight_type_count: characterStoryBenchmarkPreflightImplemented ? 1 : 0,
      benchmark_source_snapshot_ready_count: characterSourceSnapshotReadyCount,
      bridge_activation_plan_ready_count: characterBridgeActivationPlanReadyCount,
      strict_technical_ready_count: characterStrictTechnicalReadyCount,
      real_model_execution_ready_count: characterRealModelExecutionReadyCount,
      benchmark_prompt_contract_type_count: characterBenchmarkPromptContractImplemented ? 1 : 0,
      strict_scene_output_contract_type_count: characterStrictSceneOutputContractImplemented ? 1 : 0,
      strict_real_model_bridge_type_count: characterStrictBridgeImplemented ? 1 : 0,
      benchmark_run_ledger_type_count: characterBenchmarkRunLedgerImplemented ? 1 : 0,
      artifact_integrity_contract_type_count: characterArtifactContractImplemented ? 1 : 0,
      blind_review_threshold_contract_type_count: characterBlindReviewThresholdImplemented ? 1 : 0,
      controlled_runner_type_count: characterControlledRunnerImplemented ? 1 : 0,
      controlled_run_plan_project_count: characterControlledRunPlanProjectCount,
      prepared_run_ledger_count: characterPreparedRunLedgerCount,
      controlled_blocked_run_count: characterControlledBlockedRunCount,
      post_initial_coordinator_type_count: characterPostInitialCoordinatorImplemented ? 1 : 0,
      finalization_candidate_gate_type_count: characterFinalizationCandidateGateImplemented ? 1 : 0,
      lifecycle_plan_type_count: characterLifecyclePlanImplemented ? 1 : 0,
      lifecycle_plan_project_count: characterLifecyclePlanProjectCount,
      lifecycle_awaiting_verified_initial_count: characterLifecycleAwaitingInitialCount,
      finalization_candidate_count: characterFinalizationCandidateCount,
      signed_release_count: characterSignedReleaseCount,
      model_invocation_count: characterModelInvocationCount,
      real_model_completed_count: characterRealModelCompletedCount,
      fixed_regression_project_count: 0,
      fixed_regression_project_target: 75,
      human_blind_review_pass_project_count: 0,
      human_blind_review_pass_project_target: 45,
      human_approved_golden_card_count: humanApprovedGoldenCount,
      human_approved_golden_card_target: 75,
      hard_gate_failure_count: 15,
      hard_gate_failure_scope: 'video_type capability gate; no real-model professional output set has been evaluated yet',
      evaluated_professional_output_count: 0,
      local_candidate_fixture_evaluation_count: 15,
      failure_fixture_evaluation_count: characterFailureFixtureCount
        + historicalFailureFixtureCount
        + legendFailureFixtureCount
        + childrenFailureFixtureCount
        + comicFailureFixtureCount
        + culturePromoFailureFixtureCount+heritagePromoFailureFixtureCount+cityBrandFailureFixtureCount+socialShortFailureFixtureCount+documentaryShortFailureFixtureCount+explainerVideoFailureFixtureCount+lectureVideoFailureFixtureCount+educationTrainingFailureFixtureCount+sceneShortFailureFixtureCount+landscapeMoodFailureFixtureCount,
      fixture_regression_count_excluded_from_professional_pass: fixtureCount,
      multi_round_revision_contract_implemented: multiRoundRevisionContractImplemented,
      multi_round_revision_project_spec_count: multiRoundRevisionProjectSpecCount,
      completed_two_round_verified_project_count: completedTwoRoundVerifiedProjectCount,
      recorded_verified_revision_round_count: recordedVerifiedRevisionRoundCount,
      multi_round_revision_failure_fixture_count: multiRoundRevisionFailureFixtureCount,
      multi_round_revision_execution_implemented: multiRoundRevisionExecutionImplemented,
      planned_revision_round_count: plannedRevisionRoundCount,
      blocked_revision_project_count: blockedRevisionProjectCount,
      ready_for_round_1_project_count: readyForRound1ProjectCount,
    },
    validation_checkpoint: {
      status: validatedMode ? 'passed' : 'not_recorded',
      commands: [
        'cd mcp-server && npm test',
        'cd web/server && npm test',
        'cd mcp-server && npm run build',
        'cd web && npm run check',
        'cd mcp-server && npm run kb:lint',
        'npx tsx --tsconfig web/server/tsconfig.json scripts/story-agent-character-benchmark-preflight.ts --check',
        'npx tsx --tsconfig web/server/tsconfig.json scripts/story-agent-character-benchmark-runner.mts --check',
        'npx tsx --tsconfig web/server/tsconfig.json scripts/story-agent-character-benchmark-lifecycle-plan.mts --check',
        'npx tsx --tsconfig web/server/tsconfig.json scripts/story-agent-multi-round-revision-execution-plan.mts --check',
        'node scripts/story-agent-governance-dry-run.mjs --check',
        'npx tsx --tsconfig web/server/tsconfig.json scripts/story-agent-professional-text-stage0-audit.ts --check',
        'git diff --check',
      ],
      results: validatedMode ? {
        mcp_test_files_passed: 79,
        mcp_test_cases_passed: 345,
        web_server_test_files_passed: 61,
        web_server_test_cases_passed: 711,
        mcp_build_passed: true,
        web_check_passed: true,
        knowledge_base_lint_passed: true,
        character_story_benchmark_preflight_check_passed: true,
        character_story_controlled_run_plan_check_passed: true,
        character_story_lifecycle_plan_check_passed: true,
        multi_round_revision_execution_manifest_check_passed: true,
        governance_checkpoint_check_passed: true,
        audit_contract_check_passed: true,
        git_diff_check_passed: true,
      } : undefined,
    },
    evidence_exclusions: [
      '9 个 local regression fixture 不计固定专业回归项目或专业质量通过。',
      '30 张 pending_human_review 黄金卡不计人工通过。',
      'simulation、template、local fallback 和本地结构分数不计真人盲评。',
      'character_story 的 5 个项目规格未运行真实模型，不计固定真实回归项目。',
      'character_story 的 5 个源快照和执行预检包未调用模型，不计固定真实回归项目。',
      'character_story 的 5 个受控运行计划、prepared ledger 和生命周期计划未调用模型；严格桥接、artifact 完整性、盲评阈值与终审候选门禁均不计专业通过。',
      'strict bridge/CLI 技术锚 5/5 只表示固定执行入口可核验，不表示 operator/付费/凭据授权或真实运行就绪。',
      'finalization candidate 即使满足机器合同也必须等待外部真人证据与 signed release；当前签署数为 0。',
      '本机桥接脚本和 Claude CLI 存在只计激活方案，不代表凭据有效、付费执行获准或真实模型项目完成。',
      'character_story 的 1 个候选 fixture 和 3 个失败 fixture 不计专业文本包通过。',
      'historical_drama 的 1 个候选 fixture、5 个项目规格和 3 个失败 fixture 不计真实模型项目、真人评审或专业通过。',
      'legend_story 的 1 个候选 fixture、5 个项目规格和 3 个失败 fixture 不计真实模型项目、真人评审或专业通过；传说内容本身不计确证历史。',
      'children_story 的 1 个候选 fixture、5 个项目规格和 3 个失败 fixture 不计真实模型项目、儿童安全评审、真人盲评或专业通过。',
      'ai_comic_drama 的 1 个候选 fixture、5 个待运行规格、3 个失败 fixture 和 pending 黄金卡均不计真实模型项目、漫剧导演评审或专业通过。',
      'culture_promo 的 1 个候选 fixture、5 个待运行规格和 3 个失败 fixture 不计真实模型项目、品牌/导演人审或专业通过。',
      '现有素材库 overall_progress_percent=99 不映射到本路线。',
      '827/99 历史治理和 5 个外部 artifact 的完成状态不映射到本路线。',
    ],
    parallel_governance_track: {
      excluded_from_professional_text_creation_progress: true,
      source_queue: 'data/reports/story-agent-monitor-remediation-queue-20260710.json',
      integrated_plan: 'docs/story-agent-integrated-execution-plan-20260710.md',
      archive_or_rebuild_candidate_count: remediationSummary.archive_or_rebuild_candidate_count,
      recommended_default_action: 'reversible_soft_archive_with_curated_rebuild_whitelist',
      soft_archive_signoff_exclusion_applied: archivePolicy.signoff_exclusion_applied,
      soft_archive_signoff_excluded_count: archiveSummary.applied_count,
      destructive_delete_count: archiveSummary.deletion_count,
      relink_candidate_count: remediationSummary.relink_candidate_count,
      relink_triaged_count: relinkSummary.candidate_count,
      relink_resolved_count: relinkSummary.resolved_count,
      safe_auto_relink_count: remediationSummary.relink_auto_recovery_safe_count,
      suffix_hint_manual_review_count: remediationSummary.relink_potential_suffix_match_project_count,
      target_project_id: externalHandoffProject.project_id,
      target_external_ready_count: externalHandoff.external_ready_count,
      target_local_acceptance_ready_count: externalHandoff.local_acceptance_ready_count,
      target_pending_external_artifact_count: externalHandoff.pending_external_artifact_count,
      guessed_relink_count: 0,
    },
    next_iteration: {
      iteration_id: stage6Iteration2Ready
        ? 'stage_6_iteration_2_external_execution'
        : stage6Iteration1Ready
        ? 'stage_6_iteration_2'
        : stage5Iteration2Ready
        ? 'stage_6_iteration_1'
        : stage5Iteration1Ready
        ? 'stage_5_iteration_2'
        : stage4Iteration4Ready
        ? 'stage_5_iteration_1'
        : stage4Iteration3Ready
        ? 'stage_4_iteration_4'
        : stage4Iteration2Ready
        ? 'stage_4_iteration_3'
        : stage4Iteration1Ready
        ? 'stage_4_iteration_2'
        : stage3Iteration4Ready
        ? 'stage_4_iteration_1'
        : stage3Iteration3Ready
        ? 'stage_3_iteration_4'
        : stage3Iteration2Ready
          ? 'stage_3_iteration_3'
        : stage3Iteration1Ready
        ? 'stage_3_iteration_2'
        : iteration7ImplementationReady
          ? 'stage_3_iteration_1'
        : iteration6ImplementationReady
          ? 'iteration_7'
        : iteration5ImplementationReady
          ? 'iteration_6'
        : iteration4ImplementationReady
          ? 'iteration_5'
        : iteration3ImplementationReady
          ? 'iteration_3_validation'
          : iteration2Complete
            ? 'iteration_3'
            : 'iteration_2',
      label: stage6Iteration2Ready
        ? '等待并导入15个真实项目、初始专业文本包、两轮创作授权和三类桌读评审后执行30轮修订'
        : stage6Iteration1Ready
        ? '执行 15 个真实项目的桌读和两轮修订，保存逐轮质量增量证据'
        : stage5Iteration2Ready
        ? '进入 Coverage、桌读和多轮修订，形成跨片型可追溯质量增量'
        : stage5Iteration1Ready
        ? '继续 landscape_mood 空间意境纵向内部能力，同时等待前十四片型外部真实证据'
        : stage4Iteration4Ready
        ? '进入 scene_short 空间意境纵向内部能力，同时等待前十三片型外部真实证据'
        : stage4Iteration3Ready
        ? '继续 education_training 非虚构纵向内部能力，同时等待前十二片型外部真实证据'
        : stage4Iteration2Ready
        ? '继续 lecture_video 非虚构纵向内部能力，同时等待前十一片型外部真实证据'
        : stage4Iteration1Ready
        ? '继续 explainer_video 非虚构纵向内部能力，同时等待前十片型外部真实证据'
        : stage3Iteration4Ready
        ? '进入 documentary_short 非虚构纵向内部能力，同时等待前九片型外部真实证据'
        : stage3Iteration3Ready
        ? '继续 social_short 纵向内部能力，同时等待前八片型外部真实证据'
        : stage3Iteration2Ready
          ? '继续 city_brand_promo 纵向内部能力，同时等待前七片型外部真实证据'
        : stage3Iteration1Ready
        ? '继续 heritage_promo 纵向内部能力，同时等待前六片型外部真实证据'
        : iteration7ImplementationReady
          ? '进入宣传传播线 culture_promo，同时等待剧情线外部真实证据'
        : iteration6ImplementationReady
          ? '继续 ai_comic_drama 纵向内部能力，同时等待前四片型外部真实证据'
        : iteration5ImplementationReady
          ? '继续 children_story 纵向内部能力，同时等待前三片型外部真实证据'
        : iteration4ImplementationReady
          ? '继续 legend_story 纵向内部能力，同时等待 character_story / historical_drama 外部真实证据'
        : iteration3ImplementationReady
          ? '在独立 operator 授权后执行 character_story 固定真实模型回归、修订增量与真人评审'
        : iteration2Complete
          ? 'character_story 首个纵向片型升级'
          : 'ProfessionalTextPackage 合同',
      acceptance_target: stage6Iteration2Ready
        ? '解除逐项目八类阻断后执行30轮真实修订；至少15项目各完成两轮，并保存真实provenance、成本、桌读关闭、质量增量和派生文本重建证据。'
        : stage6Iteration1Ready
        ? '15 个片型各至少 1 个真实项目完成两轮以上修订；每轮具备真实 provenance、桌读意见关闭、前后哈希、质量增量和派生文本重建记录，fixture/simulation 不计。'
        : stage5Iteration2Ready
        ? '至少 15 个真实项目完成两轮以上修订，保存 Coverage、桌读反馈、版本差异、质量增量与派生文本重建记录；fixture/simulation 不计专业通过。'
        : stage5Iteration1Ready
        ? '为 landscape_mood 建立情绪命题、时间变化、构图节奏、自然声音和极简文案的 opt-in 专业链；前十四片型规格继续等待真实模型与真人盲评，fixture 不计。'
        : stage4Iteration4Ready
        ? '为 scene_short 建立空间路线、人物或事件触发、镜头行动、声音和转场的 opt-in 专业链；前十三片型规格继续等待真实模型与真人盲评，fixture 不计。'
        : stage4Iteration3Ready
        ? '为 education_training 建立学习目标、知识步骤、案例、练习、评估和复盘的 opt-in 专业链；前十二片型规格继续等待真实模型与真人盲评，fixture 不计。'
        : stage4Iteration2Ready
        ? '为 lecture_video 建立立论、论证、案例、反方、修辞转场和行动结论的 opt-in 专业链；前十一片型规格继续等待真实模型与真人盲评，fixture 不计。'
        : stage4Iteration1Ready
        ? '为 explainer_video 建立问题、概念、例子、视觉比喻、误区和总结的 opt-in 专业链；前十片型规格继续等待真实模型与真人盲评，fixture 不计。'
        : stage3Iteration4Ready
        ? '为 documentary_short 建立核心问题、现实现场、采访角色、史料线索、B-roll和再现边界的 opt-in 专业链；前九片型规格继续等待真实模型与真人盲评，fixture 不计。'
        : stage3Iteration3Ready
        ? '为 social_short 建立首屏钩子、单一信息、平台节奏、可见动作、完播与互动召唤的 opt-in 专业链；前八片型规格继续等待真实模型与真人盲评，fixture 不计。'
        : stage3Iteration2Ready
          ? '为 city_brand_promo 建立城市命题、人物视点、空间路线、在地生活、转场逻辑、品牌落点和地理边界的 opt-in 专业链；前七片型规格继续等待真实模型与真人盲评，fixture 不计。'
        : stage3Iteration1Ready
        ? '为 heritage_promo 建立材料、工具、工序、手部动作、传承压力和授权安全边界的专业链。'
        : iteration7ImplementationReady
          ? '为 culture_promo 建立传播命题、视觉符号、信息曲线、旁白与行动召唤的 opt-in 专业链；剧情线25个规格继续等待真实模型与真人盲评。'
        : iteration6ImplementationReady
          ? '为 ai_comic_drama 建立集钩子、关系碰撞、可分格动作、气泡对白、表情节拍和资产连续性的 opt-in 专业链；前四片型规格继续等待真实模型与真人盲评，fixture 不计。'
        : iteration5ImplementationReady
          ? '为 children_story 建立年龄适配、温和冲突、重复母题、情绪学习和成人提示边界的 opt-in 专业链；前三片型规格继续等待真实模型与真人盲评，fixture 不计。'
        : iteration4ImplementationReady
          ? '为 legend_story 建立版本边界、象征意象、凡人选择、口述节奏的 opt-in 专业链；同时 historical_drama 的 5 个规格必须等待真实模型初稿、修订增量和三角色真人盲评，fixture 不计。'
        : iteration3ImplementationReady
          ? '保持固定 strict bridge，独立核验凭据/付费授权/CLI 哈希/批次预算后运行 5 个项目，保存初稿/终稿/版本/成本并完成人工盲评；fixture 和 fallback 不计。'
        : iteration2Complete
          ? '完成 character_story 从创作简报到专业成稿的纵向链路、5 个固定真实项目和至少 3 个失败样本。'
          : '15 个片型均能生成合法专业文本包骨架；保持旧故事和旧项目兼容。',
    },
    external_blockers: [
      '真人编剧/剧本编辑、类型/导演、事实/文化评审者尚未指定。',
      '授权专业结构基准尚未提供。',
      '真实模型固定项目、成本和修订记录尚未建立。',
      'strict bridge 与 Claude CLI 技术锚已建立 5/5，但凭据未核验、独立付费授权/预算未提供；授权真实模型可执行数为 0。',
      '30 张黄金卡和 9 个 Domain Pack 候选尚未完成真实人工审稿。',
    ],
  };
  validateAudit(matrix, progress);
  return {
    matrix,
    progress,
    matrixMarkdown: renderMatrixMarkdown(matrix),
    gapMarkdown: renderGapMarkdown({ generatedAt, summary, progress, matrix }),
  };
}

function validateAudit(matrix: JsonRecord, progress: JsonRecord): void {
  const rows = matrix.video_types as JsonRecord[];
  if (rows.length !== 15) throw new Error(`Expected 15 video types, got ${rows.length}`);
  if (new Set(rows.map(row => row.video_type)).size !== 15) throw new Error('Duplicate VideoType rows');
  if (rows.some(row => row.professional_text_package_passed !== false)) {
    throw new Error('Contract or skeleton evidence must not mark any ProfessionalTextPackage as professionally passed');
  }
  if (matrix.stage !== 'stage_0' && rows.some(row =>
    row.professional_text_package_contract_implemented !== true
    || row.professional_text_package_skeleton_schema_passed !== true
  )) {
    throw new Error('Stage 1+ checkpoint requires all 15 schema-valid package skeletons');
  }
  if (matrix.stage === 'stage_2') {
    const summary = matrix.summary as JsonRecord;
    const expectedVerticalTypeCount = matrix.iteration === 'iteration_7'
      ? 5
      : matrix.iteration === 'iteration_6'
        ? 4
      : matrix.iteration === 'iteration_5'
        ? 3
      : matrix.iteration === 'iteration_4'
        ? 2
        : 1;
    if (summary.professional_vertical_pipeline_type_count !== expectedVerticalTypeCount
      || summary.professional_quality_evaluator_type_count !== expectedVerticalTypeCount
      || summary.professional_revision_planner_type_count !== expectedVerticalTypeCount
      || summary.fixed_project_spec_count !== 5
      || Number(summary.failure_fixture_count) < 3
      || summary.benchmark_preflight_type_count !== 1
      || summary.benchmark_source_snapshot_ready_count !== 5
      || summary.bridge_activation_plan_ready_count !== 5
      || summary.strict_technical_ready_count !== 5
      || summary.benchmark_prompt_contract_type_count !== 1
      || summary.strict_scene_output_contract_type_count !== 1
      || summary.strict_real_model_bridge_type_count !== 1
      || summary.benchmark_run_ledger_type_count !== 1
      || summary.artifact_integrity_contract_type_count !== 1
      || summary.blind_review_threshold_contract_type_count !== 1
      || summary.controlled_runner_type_count !== 1
      || summary.controlled_run_plan_project_count !== 5
      || summary.prepared_run_ledger_count !== 5
      || summary.controlled_blocked_run_count !== 5
      || summary.post_initial_coordinator_type_count !== 1
      || summary.finalization_candidate_gate_type_count !== 1
      || summary.lifecycle_plan_type_count !== 1
      || summary.lifecycle_plan_project_count !== 5
      || summary.lifecycle_awaiting_verified_initial_count !== 5
      || summary.finalization_candidate_count !== 0
      || summary.signed_release_count !== 0
      || summary.model_invocation_count !== 0
      || summary.real_model_completed_count !== 0
      || ((matrix.iteration === 'iteration_4' || matrix.iteration === 'iteration_5' || matrix.iteration === 'iteration_6' || matrix.iteration === 'iteration_7')
        && (summary.historical_drama_fixed_project_spec_count !== 5
          || Number(summary.historical_drama_failure_fixture_count) < 3
          || (matrix.iteration === 'iteration_4'
            && (summary.fixed_project_spec_total_count !== 10
              || summary.failure_fixture_total_count !== 6))))
      || (matrix.iteration === 'iteration_5'
        && (summary.legend_story_fixed_project_spec_count !== 5
          || Number(summary.legend_story_failure_fixture_count) < 3
          || (matrix.iteration === 'iteration_5'
            && (summary.fixed_project_spec_total_count !== 15
              || summary.failure_fixture_total_count !== 9))))
      || (matrix.iteration === 'iteration_6'
        && (summary.legend_story_fixed_project_spec_count !== 5
          || Number(summary.legend_story_failure_fixture_count) < 3
          || summary.children_story_fixed_project_spec_count !== 5
          || Number(summary.children_story_failure_fixture_count) < 3
          || summary.fixed_project_spec_total_count !== 20
          || (matrix.iteration === 'iteration_6' && summary.failure_fixture_total_count !== 12)))
      || (matrix.iteration === 'iteration_7'
        && (summary.children_story_fixed_project_spec_count !== 5
          || summary.ai_comic_drama_fixed_project_spec_count !== 5
          || Number(summary.ai_comic_drama_failure_fixture_count) < 3
          || summary.fixed_project_spec_total_count !== 25
          || summary.failure_fixture_total_count !== 15))) {
      throw new Error(`Stage 2 / ${matrix.iteration} implementation checkpoint is incomplete`);
    }
  }
  if (matrix.stage === 'stage_5' && matrix.iteration === 'iteration_2') {
    const summary = matrix.summary as JsonRecord;
    if (summary.professional_vertical_pipeline_type_count !== 15
      || summary.professional_quality_evaluator_type_count !== 15
      || summary.professional_revision_planner_type_count !== 15
      || summary.landscape_mood_fixed_project_spec_count !== 5
      || summary.landscape_mood_failure_fixture_count !== 3
      || summary.fixed_project_spec_total_count !== 75
      || summary.failure_fixture_total_count !== 45) {
      throw new Error('Stage 5 / iteration_2 all-format implementation checkpoint is incomplete');
    }
  }
  if (matrix.stage === 'stage_6' && matrix.iteration === 'iteration_1') {
    const summary = matrix.summary as JsonRecord;
    if (summary.multi_round_revision_contract_implemented !== true
      || summary.multi_round_revision_project_spec_count !== 15
      || summary.completed_two_round_verified_project_count !== 0
      || summary.recorded_verified_revision_round_count !== 0
      || summary.multi_round_revision_failure_fixture_count !== 3) {
      throw new Error('Stage 6 / iteration_1 multi-round revision contract checkpoint is incomplete');
    }
  }
  if (matrix.stage === 'stage_6' && matrix.iteration === 'iteration_2') {
    const summary = matrix.summary as JsonRecord;
    if (summary.multi_round_revision_execution_implemented !== true
      || summary.planned_revision_round_count !== 30
      || summary.blocked_revision_project_count !== 15
      || summary.ready_for_round_1_project_count !== 0
      || summary.completed_two_round_verified_project_count !== 0
      || summary.recorded_verified_revision_round_count !== 0) {
      throw new Error('Stage 6 / iteration_2 fail-closed execution preparation checkpoint is incomplete');
    }
  }
  const dimensions = progress.dimensions as ProgressDimension[];
  if (dimensions.reduce((sum, item) => sum + item.weight_percent, 0) !== 100) {
    throw new Error('Progress dimension weights must total 100');
  }
  const computed = round(dimensions.reduce((sum, item) => sum + item.earned_percent, 0));
  if (computed !== progress.professional_text_creation_progress_percent) {
    throw new Error('Progress total does not match dimension evidence');
  }
  const metrics = progress.metrics as JsonRecord;
  if (metrics.fixed_regression_project_count !== 0 || metrics.human_blind_review_pass_project_count !== 0) {
    throw new Error('Fixture/simulation evidence cannot count as professional benchmark pass');
  }
}

async function writeOutputs(outputs: Awaited<ReturnType<typeof buildAudit>>): Promise<void> {
  const matrixPath = path.join(repoRoot, 'data', 'reports', 'story-agent-professional-text-capability-matrix.json');
  const progressPath = path.join(repoRoot, 'data', 'reports', 'story-agent-professional-text-creation-progress.json');
  const matrixMarkdownPath = path.join(repoRoot, 'docs', 'story-agent-professional-text-capability-matrix-20260710.md');
  const gapMarkdownPath = path.join(repoRoot, 'docs', 'story-agent-professional-text-gap-report-20260710.md');
  await Promise.all([
    fs.writeFile(matrixPath, `${JSON.stringify(outputs.matrix, null, 2)}\n`, 'utf8'),
    fs.writeFile(progressPath, `${JSON.stringify(outputs.progress, null, 2)}\n`, 'utf8'),
    fs.writeFile(matrixMarkdownPath, outputs.matrixMarkdown, 'utf8'),
    fs.writeFile(gapMarkdownPath, outputs.gapMarkdown, 'utf8'),
  ]);
}

async function checkWrittenOutputs(): Promise<void> {
  const matrix = await readJson(path.join(repoRoot, 'data', 'reports', 'story-agent-professional-text-capability-matrix.json'));
  const progress = await readJson(path.join(repoRoot, 'data', 'reports', 'story-agent-professional-text-creation-progress.json'));
  validateAudit(matrix, progress);
  const summary = matrix.summary as JsonRecord;
  if (summary.fixture_regression_count !== 9) throw new Error('Expected 9 excluded regression fixtures');
  if (summary.human_approved_golden_card_count !== 0) throw new Error('Pending golden cards cannot count as approved');
  if (summary.fixed_project_spec_count !== 5) throw new Error('Expected 5 fixed character_story project specs');
  if (summary.failure_fixture_count !== 3) throw new Error('Expected 3 excluded character_story failure fixtures');
  if (summary.historical_drama_fixed_project_spec_count !== 5) {
    throw new Error('Expected 5 fixed historical_drama project specs');
  }
  if (summary.historical_drama_failure_fixture_count !== 3) {
    throw new Error('Expected 3 excluded historical_drama failure fixtures');
  }
  if (summary.legend_story_fixed_project_spec_count !== 5) {
    throw new Error('Expected 5 fixed legend_story project specs');
  }
  if (summary.legend_story_failure_fixture_count !== 3) {
    throw new Error('Expected 3 excluded legend_story failure fixtures');
  }
  if (summary.children_story_fixed_project_spec_count !== 5) {
    throw new Error('Expected 5 fixed children_story project specs');
  }
  if (summary.children_story_failure_fixture_count !== 3) {
    throw new Error('Expected 3 excluded children_story failure fixtures');
  }
  if (summary.ai_comic_drama_fixed_project_spec_count !== 5 || summary.ai_comic_drama_failure_fixture_count !== 3) {
    throw new Error('Expected 5 ai_comic_drama specs and 3 excluded failure fixtures');
  }
  if (summary.culture_promo_fixed_project_spec_count !== 5 || summary.culture_promo_failure_fixture_count !== 3) {
    throw new Error('Expected 5 culture_promo specs and 3 excluded failure fixtures');
  }
  if (summary.heritage_promo_fixed_project_spec_count !== 5 || summary.heritage_promo_failure_fixture_count !== 3) throw new Error('Expected heritage specs');
  if (summary.city_brand_promo_fixed_project_spec_count !== 5 || summary.city_brand_promo_failure_fixture_count !== 3) throw new Error('Expected city brand specs');
  if (summary.social_short_fixed_project_spec_count !== 5 || summary.social_short_failure_fixture_count !== 3) throw new Error('Expected social short specs');
  if (summary.documentary_short_fixed_project_spec_count !== 5 || summary.documentary_short_failure_fixture_count !== 3) throw new Error('Expected documentary short specs');
  if (summary.explainer_video_fixed_project_spec_count !== 5 || summary.explainer_video_failure_fixture_count !== 3) throw new Error('Expected explainer video specs');
  if (summary.lecture_video_fixed_project_spec_count !== 5 || summary.lecture_video_failure_fixture_count !== 3) throw new Error('Expected lecture video specs');
  if (summary.education_training_fixed_project_spec_count !== 5 || summary.education_training_failure_fixture_count !== 3) throw new Error('Expected education training specs');
  if (summary.scene_short_fixed_project_spec_count !== 5 || summary.scene_short_failure_fixture_count !== 3) throw new Error('Expected scene short specs');
  if (summary.landscape_mood_fixed_project_spec_count !== 5 || summary.landscape_mood_failure_fixture_count !== 3) throw new Error('Expected landscape mood specs');
  if (summary.fixed_project_spec_total_count !== 75 || summary.failure_fixture_total_count !== 45) {
    throw new Error('Expected seventy-five specs and forty-five fixtures');
  }
  if (summary.multi_round_revision_contract_implemented !== true
    || summary.multi_round_revision_project_spec_count !== 15
    || summary.completed_two_round_verified_project_count !== 0
    || summary.recorded_verified_revision_round_count !== 0
    || summary.multi_round_revision_failure_fixture_count !== 3) {
    throw new Error('Expected fail-closed Stage 6 multi-round revision specs without real completion credit');
  }
  if (summary.multi_round_revision_execution_implemented !== true
    || summary.planned_revision_round_count !== 30
    || summary.blocked_revision_project_count !== 15
    || summary.ready_for_round_1_project_count !== 0) {
    throw new Error('Expected thirty planned and fifteen blocked Stage 6 revision executions');
  }
  if (summary.benchmark_preflight_type_count !== 1) throw new Error('Expected character_story benchmark preflight implementation');
  if (summary.benchmark_source_snapshot_ready_count !== 5) throw new Error('Expected 5 character_story benchmark source snapshots');
  if (summary.bridge_activation_plan_ready_count !== 5) throw new Error('Expected 5 character_story bridge activation plans');
  if (summary.strict_technical_ready_count !== 5) throw new Error('Expected 5 dedicated strict technical anchors');
  if (summary.real_model_execution_ready_count !== 0) throw new Error('Unauthenticated preflight cannot be reported as real-model ready');
  if (summary.controlled_run_plan_project_count !== 5
    || summary.prepared_run_ledger_count !== 5
    || summary.controlled_blocked_run_count !== 5) {
    throw new Error('Expected five prepared and explicitly blocked controlled benchmark runs');
  }
  if (summary.model_invocation_count !== 0 || summary.real_model_completed_count !== 0) {
    throw new Error('Controlled planning must not report model invocation or real-model completion');
  }
  if (summary.strict_scene_output_contract_type_count !== 1
    || summary.post_initial_coordinator_type_count !== 1
    || summary.finalization_candidate_gate_type_count !== 1
    || summary.lifecycle_plan_type_count !== 1
    || summary.lifecycle_plan_project_count !== 5
    || summary.lifecycle_awaiting_verified_initial_count !== 5
    || summary.finalization_candidate_count !== 0
    || summary.signed_release_count !== 0) {
    throw new Error('Expected fail-closed full-lifecycle contracts without signed professional credit');
  }
  if ((progress.validation_checkpoint as JsonRecord).status !== 'passed') {
    throw new Error('Professional text validation checkpoint must be recorded as passed');
  }
}

async function main(): Promise<void> {
  if (checkMode) {
    await checkWrittenOutputs();
    console.log('Professional text capability and progress outputs passed contract checks.');
    return;
  }
  const outputs = await buildAudit();
  if (writeMode) await writeOutputs(outputs);
  const summary = outputs.matrix.summary as JsonRecord;
  console.log(JSON.stringify({
    written: writeMode,
    video_type_coverage_count: summary.video_type_coverage_count,
    professional_text_package_pass_count: summary.professional_text_package_pass_count,
    fixed_real_model_regression_project_count: summary.fixed_real_model_regression_project_count,
    human_blind_review_pass_project_count: summary.human_blind_review_pass_project_count,
    human_approved_golden_card_count: summary.human_approved_golden_card_count,
    hard_gate_failure_type_count: summary.professional_capability_hard_gate_failure_type_count,
    professional_text_creation_progress_percent: outputs.progress.professional_text_creation_progress_percent,
  }, null, 2));
}

void main();
