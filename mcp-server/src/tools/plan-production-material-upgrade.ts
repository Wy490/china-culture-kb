import type { VideoType } from '../types.js';
import { auditProductionMaterials } from './audit-production-materials.js';

type ProductionMaterialAuditReport = Awaited<ReturnType<typeof auditProductionMaterials>>;
type EntryAudit = ProductionMaterialAuditReport['entries'][number];

type UpgradeBatchId =
  | 'credibility_format_normalization'
  | 'machine_metadata_enrichment'
  | 'source_location_backfill'
  | 'asset_split_enrichment'
  | 'heritage_promo_minimum_pack'
  | 'documentary_short_minimum_pack'
  | 'explainer_video_minimum_pack'
  | 'ai_comic_drama_minimum_pack'
  | 'domain_pack_expansion';

interface UpgradeAction {
  action_id: string;
  entry_name: string;
  province: string;
  type: string;
  priority: EntryAudit['priority'];
  production_card_score: number;
  issue_tags: string[];
  recommended_fields: string[];
  recommended_questions: string[];
  safe_auto_apply: 'none' | 'format_only';
}

interface UpgradeBatch {
  batch_id: UpgradeBatchId;
  phase: string;
  label: string;
  goal: string;
  rationale: string;
  entry_count: number;
  actions: UpgradeAction[];
  acceptance_criteria: string[];
}

interface DomainPackExpansionItem {
  pack_id: string;
  label: string;
  priority: 'high' | 'medium';
  reason: string;
  seed_fields: string[];
}

export interface ProductionMaterialUpgradePlan {
  schema_version: 'kb-production-material-upgrade-plan/v1';
  generated_at: string;
  source_audit_generated_at: string;
  summary: {
    total_entries: number;
    high_priority_entries: number;
    planned_batches: number;
    planned_entry_actions: number;
    format_only_actions: number;
  };
  batches: UpgradeBatch[];
  domain_pack_expansion: DomainPackExpansionItem[];
  markdown: string;
}

const VIDEO_TYPE_LABEL: Record<string, string> = {
  heritage_promo: '非遗/工艺宣传片',
  documentary_short: '微纪录片',
  explainer_video: '知识讲解视频',
  ai_comic_drama: 'AI漫剧',
};

export async function planProductionMaterialUpgrade(): Promise<ProductionMaterialUpgradePlan> {
  const audit = await auditProductionMaterials();
  const domainPackExpansion = buildDomainPackExpansion(audit);
  const batches: UpgradeBatch[] = [
    buildCredibilityFormatBatch(audit.entries),
    buildMachineMetadataBatch(audit.entries),
    buildSourceLocationBackfillBatch(audit.entries),
    buildAssetSplitBatch(audit.entries),
    buildVideoTypeBatch(audit.entries, 'heritage_promo'),
    buildVideoTypeBatch(audit.entries, 'documentary_short'),
    buildVideoTypeBatch(audit.entries, 'explainer_video'),
    buildVideoTypeBatch(audit.entries, 'ai_comic_drama'),
    buildDomainPackBatch(audit.entries, domainPackExpansion),
  ];
  const plannedEntryActions = batches.reduce((sum, batch) => sum + batch.actions.length, 0);
  const base: Omit<ProductionMaterialUpgradePlan, 'markdown'> = {
    schema_version: 'kb-production-material-upgrade-plan/v1',
    generated_at: new Date().toISOString(),
    source_audit_generated_at: audit.generated_at,
    summary: {
      total_entries: audit.totals.entries,
      high_priority_entries: audit.entries.filter(entry => entry.priority === 'high').length,
      planned_batches: batches.length,
      planned_entry_actions: plannedEntryActions,
      format_only_actions: batches
        .flatMap(batch => batch.actions)
        .filter(action => action.safe_auto_apply === 'format_only').length,
    },
    batches,
    domain_pack_expansion: domainPackExpansion,
  };

  return {
    ...base,
    markdown: buildMarkdown(base),
  };
}

function buildCredibilityFormatBatch(entries: EntryAudit[]): UpgradeBatch {
  const targets = entries
    .filter(entry =>
      !entry.has_verification_method
      || !entry.has_explicit_verification_method_section
      || entry.priority_reasons.some(reason => reason.includes('可信度非枚举')),
    )
    .sort(sortByPriority)
    .slice(0, 80);
  return {
    batch_id: 'credibility_format_normalization',
    phase: 'Phase 6',
    label: '可信度与核实格式标准化',
    goal: '把可信度收敛为枚举，把解释放到核实方法，为 gate 和检索评分打地基。',
    rationale: targets.length > 0
      ? '当前仍有条目使用“可信度与核实”合并 section，适合先做格式治理，再补内容。'
      : '当前未发现需要格式治理的可信度条目；可进入机器字段和生产资产补齐。',
    entry_count: targets.length,
    actions: targets.map(entry => actionForEntry(entry, 'credibility-format', [
      '可信度',
      '核实方法',
      '待核实点',
    ], [
      '可信度是否为：可靠 / 基本可靠 / 待核实 / 存疑 / 混合？',
      '核实方法中是否说明来源等级、互证方式和仍需核实的问题？',
    ], entry.has_merged_credibility_verification_section ? 'format_only' : 'none')),
    acceptance_criteria: [
      '可信度字段只保留枚举。',
      '核实解释进入“核实方法”。',
      '待核实点保留为列表，不把待核内容改成事实。',
    ],
  };
}

function buildMachineMetadataBatch(entries: EntryAudit[]): UpgradeBatch {
  const targets = entries
    .filter(entry => !entry.has_machine_metadata)
    .sort(sortByPriority)
    .slice(0, 80);
  return {
    batch_id: 'machine_metadata_enrichment',
    phase: 'Phase 6',
    label: '机器字段补齐',
    goal: '补齐 knowledge_domain、entry_role、era、asset_usage，让生成器知道素材用途。',
    rationale: '当前机器字段覆盖率低，导致素材像文章而不是可调度资产。',
    entry_count: targets.length,
    actions: targets.map(entry => actionForEntry(entry, 'machine-metadata', [
      'knowledge_domain',
      'entry_role',
      'era',
      'asset_usage',
    ], [
      '这个条目是核心事实、地域包、时代设定、资产包还是边界规则？',
      '它主要服务人物、场景、道具、来源边界、叙事母题还是 GEARS 交付？',
    ], 'none')),
    acceptance_criteria: [
      '每条高优先级素材至少有 knowledge_domain 和 entry_role。',
      '历史/时代相关素材有 era。',
      'asset_usage 能说明生成用途。',
    ],
  };
}

function buildSourceLocationBackfillBatch(entries: EntryAudit[]): UpgradeBatch {
  const targets = entries
    .filter(entry => entry.source_count === 0 || entry.related_location_count === 0)
    .sort(sortByPriority)
    .slice(0, 80);
  return {
    batch_id: 'source_location_backfill',
    phase: 'Phase 6',
    label: '来源与地点回溯补齐',
    goal: '为导入残留清洗后暴露出的空来源、空地点条目补齐可核实依据。',
    rationale: targets.length > 0
      ? '清洗占位符后，部分条目没有可用来源或可拍地点，必须先回溯补源再进入生产资产扩写。'
      : '当前未发现空来源或空相关地点条目。',
    entry_count: targets.length,
    actions: targets.map(entry => actionForEntry(entry, 'source-location-backfill', [
      ...(entry.source_count === 0 ? ['来源', '来源等级'] : []),
      ...(entry.related_location_count === 0 ? ['相关地点', '可拍现场'] : []),
      '核实方法',
      '待核实点',
    ], [
      '能否回溯到原始来源名称、链接、书名、馆藏或非遗名录条目？',
      '哪些地点是今天仍能拍摄或访问的现场、展馆、工坊、传习所？',
      '无法回溯的信息是否应保留为待核实，而不是写成事实？',
    ], 'none')),
    acceptance_criteria: [
      '每条至少补一个可追溯来源，并标注 A/B/C/D 级。',
      '相关地点必须是真实地点、机构、工坊、展馆或可说明的传承空间。',
      '无法回溯的旧导入信息只能进入待核实点，不能重写成事实。',
    ],
  };
}

function buildAssetSplitBatch(entries: EntryAudit[]): UpgradeBatch {
  const targets = entries
    .filter(entry => !entry.has_asset_split)
    .sort(sortByPriority)
    .slice(0, 80);
  return {
    batch_id: 'asset_split_enrichment',
    phase: 'Phase 6',
    label: '资产拆分补齐',
    goal: '补齐人物、场景、人物随身道具和场景陈设，支撑 GEARS/Seedance 生产。',
    rationale: 'asset_split 覆盖率最低，是从文化资料库升级为生产素材库的关键短板；先用 kb:asset-split-suggestions 生成候选，再人工审稿写回。',
    entry_count: targets.length,
    actions: targets.map(entry => actionForEntry(entry, 'asset-split', [
      '人物',
      '场景',
      '人物随身道具',
      '场景陈设',
    ], [
      '这个素材中有哪些稳定出场人物或群体？',
      '有哪些可拍空间、随身物、场景陈设需要保持连续？',
    ], 'none')),
    acceptance_criteria: [
      '先查看 Asset Split 建议报告，区分可审稿条目和需要先补来源/地点的条目。',
      '每条高优先级素材至少列出一个场景或人物。',
      '道具和陈设分开，不把事件名当人物。',
      '资产拆分不新增未经来源支持的硬事实。',
    ],
  };
}

function buildVideoTypeBatch(entries: EntryAudit[], videoType: VideoType): UpgradeBatch {
  const targets = entries
    .filter(entry => {
      const audit = entry.type_template_audits.find(item => item.video_type === videoType);
      return audit?.recommended && audit.readiness_score < 70;
    })
    .sort((a, b) => videoTypeScore(a, videoType) - videoTypeScore(b, videoType) || sortByPriority(a, b))
    .slice(0, 50);
  return {
    batch_id: `${videoType}_minimum_pack` as UpgradeBatchId,
    phase: 'Phase 6',
    label: `${VIDEO_TYPE_LABEL[videoType] ?? videoType}最小素材包补齐`,
    goal: `补齐${VIDEO_TYPE_LABEL[videoType] ?? videoType}生产所需的最小字段。`,
    rationale: '只补目标片型需要的字段，比泛泛扩库更快提升生成质量。',
    entry_count: targets.length,
    actions: targets.map(entry => {
      const audit = entry.type_template_audits.find(item => item.video_type === videoType);
      return actionForEntry(entry, `${videoType}-minimum-pack`, audit?.missing_fields.slice(0, 10) ?? [], questionsForVideoType(videoType), 'none');
    }),
    acceptance_criteria: [
      '补齐当前片型 required_fields 中最影响生成的字段。',
      '只记录可来源追溯的信息，戏剧化空间和事实边界分开。',
      '补完后重新运行 kb:production-audit 和 kb:production-upgrade-plan。',
    ],
  };
}

function buildDomainPackBatch(
  entries: EntryAudit[],
  domainPackExpansion: DomainPackExpansionItem[],
): UpgradeBatch {
  const targets = entries
    .filter(entry => entry.priority === 'high')
    .sort(sortByPriority)
    .slice(0, 30);
  return {
    batch_id: 'domain_pack_expansion',
    phase: 'Phase 7',
    label: 'Domain Pack 扩库牵引',
    goal: '用高频缺口反推通用素材包，减少逐条补库重复劳动。',
    rationale: '很多缺口来自同一类共性素材，如非遗流程、纪录片来源、AI 漫剧分镜和朝代设定。',
    entry_count: targets.length,
    actions: targets.map(entry => actionForEntry(entry, 'domain-pack-expansion', [
      ...domainPackExpansion.slice(0, 4).map(item => item.pack_id),
    ], [
      '这个缺口是否能通过一个通用 domain pack 覆盖多个条目？',
      '该 domain pack 应服务事实边界、视觉资产、叙事结构还是交付约束？',
    ], 'none')),
    acceptance_criteria: [
      '新增 domain pack 必须有 trigger_words、asset_usage 和边界说明。',
      '不得把 domain pack 摘要写成主条目事实。',
      '每个新增 pack 至少覆盖 5 个以上高优先级缺口。',
    ],
  };
}

function buildDomainPackExpansion(audit: ProductionMaterialAuditReport): DomainPackExpansionItem[] {
  const typeCounts = new Map<string, number>();
  for (const entry of audit.entries) {
    for (const templateAudit of entry.type_template_audits) {
      if (templateAudit.recommended && templateAudit.readiness_score < 70) {
        typeCounts.set(templateAudit.video_type, (typeCounts.get(templateAudit.video_type) ?? 0) + 1);
      }
    }
  }
  return [
    {
      pack_id: 'heritage_process_pack',
      label: '非遗流程包',
      priority: (typeCounts.get('heritage_promo') ?? 0) > 20 ? 'high' : 'medium',
      reason: '非遗条目数量高，普遍缺材料、工具、工序、手部动作和传承关系。',
      seed_fields: ['materials', 'tools', 'process_steps', 'hand_actions', 'practitioner_or_transmission_line'],
    },
    {
      pack_id: 'documentary_source_pack',
      label: '纪录片来源包',
      priority: (typeCounts.get('documentary_short') ?? 0) > 20 ? 'high' : 'medium',
      reason: '微纪录条目普遍需要现实地点、来源提示、再现边界和 B-roll 计划。',
      seed_fields: ['real_world_site_or_object', 'source_quotes_or_source_cues', 'reconstruction_boundary', 'b_roll_plan'],
    },
    {
      pack_id: 'ai_comic_storyboard_pack',
      label: 'AI漫剧分镜包',
      priority: (typeCounts.get('ai_comic_drama') ?? 0) > 20 ? 'high' : 'medium',
      reason: 'AI漫剧高频缺冲突、对白、表情节拍、关键帧和连续性验收。',
      seed_fields: ['episode_hook', 'dialogue_bubbles', 'emotion_beats', 'reference_images_or_keyframes', 'multi_shot_continuity'],
    },
    {
      pack_id: 'era_and_costume_pack',
      label: '朝代服饰与器物包',
      priority: 'medium',
      reason: '历史人物、名胜古迹和传说条目常缺时代、服饰、称谓和器物口径。',
      seed_fields: ['era', 'character_clothing', 'character_props', 'dialogue_tone', 'credibility_boundary'],
    },
    {
      pack_id: 'explainer_knowledge_structure_pack',
      label: '讲解知识结构包',
      priority: (typeCounts.get('explainer_video') ?? 0) > 20 ? 'high' : 'medium',
      reason: '知识讲解视频需要核心问题、知识层级、例子、图示字幕和误区边界，适合沉淀成通用结构包。',
      seed_fields: ['core_question', 'knowledge_outline', 'concrete_examples', 'diagram_or_caption_plan', 'misconception_or_boundary'],
    },
    {
      pack_id: 'short_video_hook_pack',
      label: '短视频钩子包',
      priority: 'medium',
      reason: '短视频和漫剧需要前三秒钩子、反转、问题和追看机制。',
      seed_fields: ['opening_hook', 'conflict_question', 'reversal', 'ending_hook'],
    },
    {
      pack_id: 'education_training_structure_pack',
      label: '宣讲/培训结构包',
      priority: 'medium',
      reason: '讲解和培训片需要学习目标、步骤、例子、复盘和练习。',
      seed_fields: ['learning_goal', 'knowledge_outline', 'steps', 'examples', 'recap'],
    },
  ];
}

function actionForEntry(
  entry: EntryAudit,
  actionPrefix: string,
  recommendedFields: string[],
  recommendedQuestions: string[],
  safeAutoApply: UpgradeAction['safe_auto_apply'],
): UpgradeAction {
  return {
    action_id: `${actionPrefix}--${safeId(entry.province)}--${safeId(entry.name)}`,
    entry_name: entry.name,
    province: entry.province,
    type: entry.type,
    priority: entry.priority,
    production_card_score: entry.production_card_score,
    issue_tags: entry.priority_reasons,
    recommended_fields: recommendedFields,
    recommended_questions: recommendedQuestions,
    safe_auto_apply: safeAutoApply,
  };
}

function questionsForVideoType(videoType: VideoType): string[] {
  if (videoType === 'heritage_promo') {
    return [
      '这门技艺的材料、工具、工序和手部动作分别是什么？',
      '传承人、学徒、工坊、展馆或社区之间是什么关系？',
      '哪些级别、年代、传承谱系必须核实后才能写？',
    ];
  }
  if (videoType === 'documentary_short') {
    return [
      '今天还能看到的地点、实物、展陈、声音或仪式是什么？',
      '哪些信息来自一手/权威来源，哪些只能做再现或推测？',
      '采访/旁白需要哪些 B-roll、档案、地图或空镜支撑？',
    ];
  }
  if (videoType === 'explainer_video') {
    return [
      '观众看完要解决的核心问题是什么？',
      '这个知识点能拆成哪3到5个层级、定义、例子或对比？',
      '哪些结论有来源支撑，哪些必须标为传说、类比或待核边界？',
    ];
  }
  if (videoType === 'ai_comic_drama') {
    return [
      '第一格钩子、主角目标、对手压力和关系碰撞分别是什么？',
      '角色稳定标签、参考图/关键帧和道具锚点是什么？',
      '单镜头与多分镜连续性要验收哪些项目？',
    ];
  }
  return ['补齐该类型 required_fields 中缺失的关键字段。'];
}

function videoTypeScore(entry: EntryAudit, videoType: VideoType): number {
  return entry.type_template_audits.find(item => item.video_type === videoType)?.readiness_score ?? 100;
}

function sortByPriority(a: EntryAudit, b: EntryAudit): number {
  return priorityWeight(b) - priorityWeight(a) || a.production_card_score - b.production_card_score || a.name.localeCompare(b.name, 'zh-Hans-CN');
}

function priorityWeight(entry: EntryAudit): number {
  if (entry.priority === 'high') return 3;
  if (entry.priority === 'medium') return 2;
  return 1;
}

function safeId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function buildMarkdown(plan: Omit<ProductionMaterialUpgradePlan, 'markdown'>): string {
  const lines: string[] = [
    '# 素材库生产化升级计划',
    '',
    `生成时间：${plan.generated_at}`,
    `来源审计时间：${plan.source_audit_generated_at}`,
    '',
    '## 总览',
    '',
    `- 条目总数：${plan.summary.total_entries}`,
    `- 高优先级条目：${plan.summary.high_priority_entries}`,
    `- 批次数：${plan.summary.planned_batches}`,
    `- 计划动作数：${plan.summary.planned_entry_actions}`,
    `- 可格式化自动处理动作：${plan.summary.format_only_actions}`,
    '',
    '## 批次',
  ];

  for (const batch of plan.batches) {
    lines.push(
      '',
      `### ${batch.label}`,
      '',
      `- 阶段：${batch.phase}`,
      `- 批次 ID：${batch.batch_id}`,
      `- 目标：${batch.goal}`,
      `- 原因：${batch.rationale}`,
      `- 条目数：${batch.entry_count}`,
      '',
      '| 条目 | 省份 | 类型 | 分数 | 优先级 | 建议字段 |',
      '|---|---|---|---:|---|---|',
      ...batch.actions.slice(0, 20).map(action =>
        `| ${action.entry_name} | ${action.province} | ${action.type} | ${action.production_card_score} | ${action.priority} | ${action.recommended_fields.join('、')} |`,
      ),
      '',
      '验收标准：',
      ...batch.acceptance_criteria.map(item => `- ${item}`),
    );
  }

  lines.push('', '## Domain Pack 扩库建议', '', '| Pack | 优先级 | 原因 | 种子字段 |', '|---|---|---|---|');
  for (const item of plan.domain_pack_expansion) {
    lines.push(`| ${item.label} | ${item.priority} | ${item.reason} | ${item.seed_fields.join('、')} |`);
  }

  lines.push(
    '',
    '## 执行原则',
    '',
    '- 先格式治理，再补事实内容。',
    '- 只把来源支持的信息写成事实；戏剧化空间和禁用表达必须分开。',
    '- 批量改写省份 Markdown 前必须先跑审计和 lint。',
  );

  return `${lines.join('\n')}\n`;
}
