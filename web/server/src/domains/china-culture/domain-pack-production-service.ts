import type {
  DomainPackProductionHealthIssue,
  DomainPackProductionHealthReport,
  DomainPackProductionHealthStatus,
  DomainPackProductionHealthSummary,
  EntryDetail,
  KnowledgeAssetUsage,
  KnowledgeAssetSplit,
  KnowledgeDomain,
  KnowledgeEntryRole,
  KnowledgePackEntry,
} from '@shared/types.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { detectChinaCultureEra } from './entry-metadata-service.js';

export interface ChinaCultureDomainPackSeed {
  entry_name: string;
  domain: KnowledgeDomain;
  role: KnowledgeEntryRole;
  type: string;
  era?: string;
  region: string;
  summary: string;
  keywords: string[];
  asset_usage: KnowledgeAssetUsage[];
  trigger_words: string[];
  production_prompts?: string[];
  review_boundaries?: string[];
}

interface ChinaCultureDomainPackFile {
  domain_id: string;
  version: string;
  description?: string;
  entries: ChinaCultureDomainPackSeed[];
}

export interface RequiredChinaCultureProductionDomainPack {
  pack_id: string;
  entry_name: string;
  expected_asset_usage: KnowledgeAssetUsage[];
}

const FALLBACK_DOMAIN_PACK_SEEDS: ChinaCultureDomainPackSeed[] = [
  {
    entry_name: '宋代士人设定包——服饰器物与称谓',
    domain: 'era_setting',
    role: 'setting_pack',
    type: '朝代设定',
    era: '宋',
    region: '通用',
    summary: '用于北宋/南宋人物故事的时代设定：士人或少年读书人可用素色交领长衫、圆领袍、布履、束发；常见随身物为书卷、手稿、毛笔、印章；台词气质应克制、含蓄，避免现代口语和现代器物。',
    keywords: ['宋', '北宋', '南宋', '士人', '读书人', '书卷', '毛笔', '圆领袍', '交领长衫'],
    asset_usage: ['character_clothing', 'character_props', 'dialogue_tone', 'credibility_boundary'],
    trigger_words: ['宋', '北宋', '南宋', '周敦颐', '濂溪', '理学', '书院', '太极图说', '爱莲说'],
  },
  {
    entry_name: '唐代传奇志异设定包——书生龙女与异界入口',
    domain: 'era_setting',
    role: 'setting_pack',
    type: '朝代设定',
    era: '唐',
    region: '通用',
    summary: '用于唐代传奇、志异和民间传说：人物服饰宜采用唐代士子、仕女、行旅者的稳定装束；故事常见书信、井口、洞府、水府、寺观等异界入口，需标明文学传说与史实边界。',
    keywords: ['唐', '唐传奇', '书生', '龙女', '水府', '洞府', '书信', '异界入口'],
    asset_usage: ['character_clothing', 'character_props', 'scene_space', 'story_motif', 'credibility_boundary'],
    trigger_words: ['唐', '柳毅', '龙女', '传奇', '水府', '洞庭', '异界'],
  },
  {
    entry_name: '志异母题包——狐鬼神怪与禁忌反转',
    domain: 'folklore_zhiyi',
    role: 'motif_pack',
    type: '志异母题',
    region: '通用',
    summary: '用于民间传说、鬼怪故事和志怪叙事：常见母题包括狐仙报恩、冤魂申诉、异梦显灵、山洞悟道、禁忌破坏、书生遇异类。供稿时必须区分传说/文学志怪/史实，不把灵异情节写成可证史实。',
    keywords: ['志异', '狐仙', '鬼怪', '冤魂', '异梦', '显灵', '禁忌', '报恩', '山洞悟道'],
    asset_usage: ['story_motif', 'credibility_boundary', 'dialogue_tone'],
    trigger_words: ['志异', '鬼', '狐', '狐仙', '妖', '怪', '冤魂', '显灵', '托梦', '传说', '神话', '灵', '洞穴悟道'],
  },
  {
    entry_name: 'GEARS场景资产包——洞穴、书院与衙署边界',
    domain: 'gears_asset',
    role: 'asset_pack',
    type: 'GEARS资产模板',
    region: '通用',
    summary: '用于供稿包资产边界：洞穴、书院、衙署、祠庙是场景资产；洞口、岩壁、石阶、书桌、案卷、油灯等是场景道具/陈设；书卷、手稿、印章、伞等可作为人物随身/标志性物件。不同事件的场景道具不得串台。',
    keywords: ['GEARS', '场景资产', '随身道具', '场景道具', '洞穴', '书院', '衙署', '资产边界'],
    asset_usage: ['character_props', 'scene_space', 'scene_props', 'gears_delivery'],
    trigger_words: ['GEARS', '供稿', '分镜', '洞', '月岩', '书院', '军衙', '衙署', '案卷', '判词', '道具', '场景'],
  },
  {
    entry_name: '月岩洞场景资产包——天然岩洞与读书传说',
    domain: 'gears_asset',
    role: 'asset_pack',
    type: 'GEARS资产模板',
    era: '宋',
    region: '湖南→永州→道县',
    summary: '月岩洞应作为场景资产处理，描述重点是天然岩洞空间、洞口、岩壁、石质地面与洞内读书悟道氛围；书卷或手稿可作为周敦颐随身物，案卷、判词等衙署案件物件不应混入月岩悟道场景。',
    keywords: ['月岩洞', '月岩悟道', '道县', '天然岩洞', '洞口', '岩壁', '石质地面', '读书悟道'],
    asset_usage: ['scene_space', 'scene_props', 'character_props', 'gears_delivery', 'credibility_boundary'],
    trigger_words: ['月岩', '月岩洞', '月岩悟道', '道县', '周敦颐', '天然溶洞', '读书悟道'],
  },
  {
    entry_name: '湖南地域传说包——洞庭、永州与湘楚叙事',
    domain: 'regional_culture',
    role: 'regional_pack',
    type: '地域文化包',
    region: '湖南',
    summary: '用于湖南地域故事的辅助背景：洞庭湖、永州、道县、汨罗、湘妃竹、柳毅传书等常以地方传说、文学志怪、历史人物相互叠加出现，生成时要保留地域线索并标明传说层级。',
    keywords: ['湖南', '永州', '道县', '洞庭湖', '汨罗', '湘楚', '地方传说', '柳毅传书'],
    asset_usage: ['story_motif', 'scene_space', 'credibility_boundary'],
    trigger_words: ['湖南', '永州', '道县', '洞庭', '汨罗', '湘楚', '岳阳', '君山'],
  },
];

let cachedDomainPackSeeds: ChinaCultureDomainPackSeed[] | null = null;

const REQUIRED_PRODUCTION_DOMAIN_PACKS: RequiredChinaCultureProductionDomainPack[] = [
  {
    pack_id: 'heritage_process_pack',
    entry_name: '非遗流程生产包——材料工具、工序动作与授权边界',
    expected_asset_usage: ['source_grounding', 'credibility_boundary'],
  },
  {
    pack_id: 'documentary_source_pack',
    entry_name: '纪录片来源包——现实现场、来源线索与再现边界',
    expected_asset_usage: ['source_grounding', 'credibility_boundary'],
  },
  {
    pack_id: 'ai_comic_storyboard_pack',
    entry_name: 'AI漫剧分镜包——关键帧、表情节拍与连续性验收',
    expected_asset_usage: ['visual_style', 'gears_delivery'],
  },
  {
    pack_id: 'era_and_costume_pack',
    entry_name: '朝代服饰与器物包——时代称谓、服装道具和事实边界',
    expected_asset_usage: ['character_clothing', 'credibility_boundary'],
  },
  {
    pack_id: 'ritual_etiquette_taboo_pack',
    entry_name: '仪式礼俗与禁忌包——流程角色、空间秩序和文化边界',
    expected_asset_usage: ['scene_space', 'safety_boundary', 'source_grounding'],
  },
  {
    pack_id: 'architectural_space_furnishing_pack',
    entry_name: '建筑空间与陈设包——空间层级、动线道具和时代边界',
    expected_asset_usage: ['scene_space', 'scene_props', 'gears_delivery'],
  },
  {
    pack_id: 'regional_language_register_pack',
    entry_name: '语言语体与地域表达包——人物身份、语境层级和方言边界',
    expected_asset_usage: ['dialogue_tone', 'source_grounding', 'credibility_boundary'],
  },
  {
    pack_id: 'natural_environment_soundscape_pack',
    entry_name: '自然环境与声景包——季节天气、地貌运动和环境声音',
    expected_asset_usage: ['scene_space', 'visual_style', 'gears_delivery'],
  },
  {
    pack_id: 'explainer_knowledge_structure_pack',
    entry_name: '讲解知识结构包——核心问题、层级例子与图示字幕',
    expected_asset_usage: ['source_grounding', 'visual_style'],
  },
  {
    pack_id: 'children_adaptation_safety_pack',
    entry_name: '儿童改写规则包——年龄分层、善意张力与事实边界',
    expected_asset_usage: ['safety_boundary', 'credibility_boundary'],
  },
  {
    pack_id: 'short_video_hook_pack',
    entry_name: '短视频钩子包——三秒问题、对比反转与平台节奏',
    expected_asset_usage: ['visual_style', 'credibility_boundary'],
  },
  {
    pack_id: 'education_training_structure_pack',
    entry_name: '宣讲培训结构包——论点案例、练习复盘与行动转化',
    expected_asset_usage: ['source_grounding', 'safety_boundary'],
  },
];

export function buildChinaCultureDomainPackEntries(context: {
  query?: string;
  entry?: EntryDetail;
  knowledgePackEntries?: KnowledgePackEntry[];
  limit?: number;
}): KnowledgePackEntry[] {
  const text = [
    context.query,
    context.entry ? [
      context.entry.name,
      context.entry.province,
      context.entry.region,
      context.entry.type,
      context.entry.summary,
      context.entry.story,
      context.entry.culturalSignificance,
      context.entry.keywords.join(' '),
      assetSplitToText(context.entry.asset_split),
    ].join(' ') : '',
    ...(context.knowledgePackEntries ?? []).map(entry => `${entry.entry_name} ${entry.summary} ${entry.keywords.join(' ')} ${assetSplitToText(entry.asset_split)}`),
  ].filter(Boolean).join(' ');
  if (!text.trim()) return [];

  const scored = getChinaCultureDomainPackSeeds()
    .map(seed => ({ seed, score: scoreDomainPackSeed(seed, text) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);
  const selected = selectDomainPackSeeds(scored, context.limit ?? 4, text);

  return selected.map(({ seed, score }) => seedToKnowledgePackEntry(seed, score));
}

export function getChinaCultureDomainPackSeeds(): ChinaCultureDomainPackSeed[] {
  if (cachedDomainPackSeeds) return cachedDomainPackSeeds;
  cachedDomainPackSeeds = loadDomainPackSeeds();
  return cachedDomainPackSeeds;
}

export function getChinaCultureDomainPackProductionHealthReport(input: {
  requiredPacks?: RequiredChinaCultureProductionDomainPack[];
  minimumTriggerWords?: number;
  minimumProductionPrompts?: number;
  minimumReviewBoundaries?: number;
  generatedAt?: string;
} = {}): DomainPackProductionHealthReport {
  const file = loadDomainPackFile();
  const seeds = getChinaCultureDomainPackSeeds();
  const requiredPacks = input.requiredPacks ?? REQUIRED_PRODUCTION_DOMAIN_PACKS;
  const minimumTriggerWords = input.minimumTriggerWords ?? 8;
  const minimumProductionPrompts = input.minimumProductionPrompts ?? 3;
  const minimumReviewBoundaries = input.minimumReviewBoundaries ?? 3;
  const seedByName = new Map(seeds.map(seed => [seed.entry_name, seed]));
  const issues: DomainPackProductionHealthIssue[] = [];
  const duplicateNames = duplicateStrings(seeds.map(seed => seed.entry_name));

  for (const entryName of duplicateNames) {
    issues.push({
      severity: 'error',
      issue_type: 'duplicate_entry_name',
      entry_name: entryName,
      message: `Domain Pack 存在重复 entry_name：${entryName}。`,
    });
  }

  const summaries: DomainPackProductionHealthSummary[] = [];
  for (const contract of requiredPacks) {
    const seed = seedByName.get(contract.entry_name);
    if (!seed) {
      issues.push({
        severity: 'error',
        issue_type: 'missing_required_pack',
        pack_id: contract.pack_id,
        entry_name: contract.entry_name,
        message: `缺少生产提示 Domain Pack：${contract.entry_name}。`,
      });
      continue;
    }

    const beforeIssueCount = issues.length;
    const triggerWordCount = seed.trigger_words.length;
    const productionPromptCount = seed.production_prompts?.filter(item => item.trim()).length ?? 0;
    const reviewBoundaryCount = seed.review_boundaries?.filter(item => item.trim()).length ?? 0;
    const missingAssetUsage = contract.expected_asset_usage.filter(usage => !seed.asset_usage.includes(usage));

    if (triggerWordCount < minimumTriggerWords) {
      issues.push({
        severity: 'warning',
        issue_type: 'underfilled_trigger_words',
        pack_id: contract.pack_id,
        entry_name: seed.entry_name,
        message: `${seed.entry_name} trigger_words 低于 ${minimumTriggerWords} 个。`,
        details: [`current=${triggerWordCount}`],
      });
    }
    if (productionPromptCount < minimumProductionPrompts) {
      issues.push({
        severity: 'warning',
        issue_type: 'underfilled_production_prompts',
        pack_id: contract.pack_id,
        entry_name: seed.entry_name,
        message: `${seed.entry_name} production_prompts 低于 ${minimumProductionPrompts} 条。`,
        details: [`current=${productionPromptCount}`],
      });
    }
    if (reviewBoundaryCount < minimumReviewBoundaries) {
      issues.push({
        severity: 'warning',
        issue_type: 'underfilled_review_boundaries',
        pack_id: contract.pack_id,
        entry_name: seed.entry_name,
        message: `${seed.entry_name} review_boundaries 低于 ${minimumReviewBoundaries} 条。`,
        details: [`current=${reviewBoundaryCount}`],
      });
    }
    if (missingAssetUsage.length > 0) {
      issues.push({
        severity: 'warning',
        issue_type: 'missing_expected_asset_usage',
        pack_id: contract.pack_id,
        entry_name: seed.entry_name,
        message: `${seed.entry_name} 缺少预期 asset_usage 标记。`,
        details: missingAssetUsage,
      });
    }

    summaries.push({
      pack_id: contract.pack_id,
      entry_name: seed.entry_name,
      domain: seed.domain,
      role: seed.role,
      trigger_word_count: triggerWordCount,
      production_prompt_count: productionPromptCount,
      review_boundary_count: reviewBoundaryCount,
      asset_usage: seed.asset_usage,
      status: domainPackHealthStatusFromIssues(issues.slice(beforeIssueCount)),
    });
  }

  const coveredRequiredPackIds = summaries.map(summary => summary.pack_id);
  const missingRequiredPackIds = requiredPacks
    .filter(contract => !coveredRequiredPackIds.includes(contract.pack_id))
    .map(contract => contract.pack_id);
  const productionReadyPackIds = summaries
    .filter(summary => summary.status === 'passed')
    .map(summary => summary.pack_id);

  return {
    schema_version: 'domain-pack-production-health/v1',
    generated_at: input.generatedAt ?? new Date().toISOString(),
    domain_id: file.domain_id,
    version: file.version,
    status: domainPackHealthStatusFromIssues(issues),
    pack_count: seeds.length,
    production_pack_count: seeds.filter(seed => (
      (seed.production_prompts?.some(item => item.trim()) ?? false)
      || (seed.review_boundaries?.some(item => item.trim()) ?? false)
    )).length,
    required_pack_ids: requiredPacks.map(contract => contract.pack_id),
    covered_required_pack_ids: coveredRequiredPackIds,
    missing_required_pack_ids: missingRequiredPackIds,
    production_ready_pack_ids: productionReadyPackIds,
    packs: summaries,
    issues,
  };
}

export function appendChinaCultureDomainPackEntries(
  supportingEntries: KnowledgePackEntry[],
  context: {
    query?: string;
    entry?: EntryDetail;
    primaryEntries?: KnowledgePackEntry[];
    limit?: number;
    includeKnowledgePackContext?: boolean;
  },
): KnowledgePackEntry[] {
  const generated = buildChinaCultureDomainPackEntries({
    query: context.query,
    entry: context.entry,
    knowledgePackEntries: context.includeKnowledgePackContext === false
      ? []
      : [...(context.primaryEntries ?? []), ...supportingEntries],
    limit: context.limit,
  });
  const existingNames = new Set(supportingEntries.map(entry => entry.entry_name));
  return [
    ...supportingEntries,
    ...generated.filter(entry => !existingNames.has(entry.entry_name)),
  ];
}

function scoreDomainPackSeed(seed: ChinaCultureDomainPackSeed, text: string): number {
  let score = 0;
  for (const word of seed.trigger_words) {
    if (word && text.includes(word)) score += word.length >= 3 ? 0.2 : 0.12;
  }
  if (seed.era && text.includes(seed.era)) score += 0.2;
  return Math.min(1, Math.round(score * 100) / 100);
}

function loadDomainPackSeeds(): ChinaCultureDomainPackSeed[] {
  const file = loadDomainPackFile();
  return file.entries.length > 0 ? file.entries : FALLBACK_DOMAIN_PACK_SEEDS;
}

function loadDomainPackFile(): ChinaCultureDomainPackFile {
  try {
    const filePath = resolve(kbRoot(), 'domain-packs', 'china-culture.json');
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as ChinaCultureDomainPackFile;
    const validEntries = Array.isArray(parsed.entries)
      ? parsed.entries.filter(isValidDomainPackSeed)
      : [];
    return {
      domain_id: typeof parsed.domain_id === 'string' && parsed.domain_id.trim() ? parsed.domain_id : 'china_culture',
      version: typeof parsed.version === 'string' && parsed.version.trim() ? parsed.version : 'unknown',
      ...(parsed.description ? { description: parsed.description } : {}),
      entries: validEntries,
    };
  } catch {
    return {
      domain_id: 'china_culture',
      version: 'fallback',
      description: 'Fallback in-memory china culture domain packs.',
      entries: FALLBACK_DOMAIN_PACK_SEEDS,
    };
  }
}

function kbRoot(): string {
  return process.env.KB_ROOT || resolve(import.meta.dirname, '..', '..', '..', '..', 'data');
}

function isValidDomainPackSeed(seed: Partial<ChinaCultureDomainPackSeed>): seed is ChinaCultureDomainPackSeed {
  return Boolean(
    seed
    && seed.entry_name
    && seed.domain
    && seed.role
    && seed.type
    && seed.region
    && seed.summary
    && Array.isArray(seed.keywords)
    && Array.isArray(seed.asset_usage)
    && Array.isArray(seed.trigger_words),
  );
}

function duplicateStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort((a, b) => a.localeCompare(b));
}

function domainPackHealthStatusFromIssues(
  issues: DomainPackProductionHealthIssue[],
): DomainPackProductionHealthStatus {
  if (issues.some(issue => issue.severity === 'error')) return 'failed';
  if (issues.length > 0) return 'warning';
  return 'passed';
}

function selectDomainPackSeeds(
  scored: Array<{ seed: ChinaCultureDomainPackSeed; score: number }>,
  limit: number,
  text: string,
): Array<{ seed: ChinaCultureDomainPackSeed; score: number }> {
  if (limit <= 0) return [];

  const selected: Array<{ seed: ChinaCultureDomainPackSeed; score: number }> = [];
  const selectedNames = new Set<string>();
  const selectedDomains = new Set<KnowledgeDomain>();

  for (const matcher of priorityDomainPackMatchers(text)) {
    if (selected.length >= limit) break;
    const item = scored.find(candidate =>
      !selectedNames.has(candidate.seed.entry_name) && matcher(candidate.seed)
    );
    if (!item) continue;
    selected.push(item);
    selectedNames.add(item.seed.entry_name);
    selectedDomains.add(item.seed.domain);
  }

  for (const item of scored) {
    if (selected.length >= limit) break;
    if (selectedDomains.has(item.seed.domain)) continue;
    selected.push(item);
    selectedNames.add(item.seed.entry_name);
    selectedDomains.add(item.seed.domain);
  }

  for (const item of scored) {
    if (selected.length >= limit) break;
    if (selectedNames.has(item.seed.entry_name)) continue;
    selected.push(item);
    selectedNames.add(item.seed.entry_name);
  }

  return selected;
}

function priorityDomainPackMatchers(text: string): Array<(seed: ChinaCultureDomainPackSeed) => boolean> {
  const matchers: Array<(seed: ChinaCultureDomainPackSeed) => boolean> = [];

  if (detectChinaCultureEra(text)) {
    matchers.push(seed => seed.domain === 'era_setting' && (!seed.era || text.includes(seed.era)));
  }
  if (/民间传说|地方传说|传说|志异|神话|狐仙|鬼怪|显灵|托梦/.test(text)) {
    matchers.push(seed => seed.domain === 'folklore_zhiyi');
  }
  if (/场景道具|道具边界|资产边界|GEARS|供稿|分镜/.test(text)) {
    matchers.push(seed =>
      seed.domain === 'gears_asset'
      && seed.asset_usage.includes('scene_props')
      && /场景道具|资产边界|随身道具/.test(`${seed.summary} ${seed.keywords.join(' ')}`)
    );
  }
  if (/月岩|洞穴|天然岩洞|读书悟道/.test(text)) {
    matchers.push(seed => seed.domain === 'gears_asset' && seed.region !== '通用');
  }
  if (/思想影响|后世影响|当代转化|学脉|传承|地方化/.test(text)) {
    matchers.push(seed => seed.domain === 'narrative_pattern');
  }
  if (/仪式|礼俗|祭礼|祭祀|节庆|婚俗|丧俗|祈愿|禁忌|空间秩序|参与角色/.test(text)) {
    matchers.push(seed => seed.entry_name.includes('仪式礼俗与禁忌包'));
  }
  if (/建筑空间|建筑陈设|传统民居|园林|祠庙|官署|书院|空间层级|人物动线|格局|展陈空间/.test(text)) {
    matchers.push(seed => seed.entry_name.includes('建筑空间与陈设包'));
  }
  if (/语言语体|地域表达|人物身份|语境层级|称谓|方言|地域语言|对白口吻|旁白语体|口音|古语/.test(text)) {
    matchers.push(seed => seed.entry_name.includes('语言语体与地域表达包'));
  }
  if (/自然环境|季节天气|季节|天气|地貌|声景|环境声音|环境声景|季相|野外/.test(text)) {
    matchers.push(seed => seed.entry_name.includes('自然环境与声景包'));
  }
  if (/儿童|少儿|亲子|年龄分层|children_story|children_animation|低龄|善意张力/.test(text)) {
    matchers.push(seed => seed.entry_name.includes('儿童改写规则包') || seed.domain === 'safety_rule');
  }
  if (/短视频|竖屏|前三秒|三秒钩子|完播|评论区|social_short|平台节奏|对比反转/.test(text)) {
    matchers.push(seed => seed.entry_name.includes('短视频钩子包'));
  }
  if (/宣讲|培训|课程|学习目标|练习|板书|lecture_video|education_training|行动转化/.test(text)) {
    matchers.push(seed => seed.entry_name.includes('宣讲培训结构包'));
  }
  if (/湖南|长沙|岳麓|永州|道县|洞庭|湘楚/.test(text)) {
    matchers.push(seed => seed.domain === 'regional_culture');
  }

  return matchers;
}

function seedToKnowledgePackEntry(seed: ChinaCultureDomainPackSeed, score: number): KnowledgePackEntry {
  const productionPrompts = Array.isArray(seed.production_prompts)
    ? seed.production_prompts.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    : [];
  const reviewBoundaries = Array.isArray(seed.review_boundaries)
    ? seed.review_boundaries.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    : [];
  return {
    entry_name: seed.entry_name,
    province: seed.region === '湖南' || seed.region.startsWith('湖南') ? '湖南' : '通用',
    region: seed.region,
    type: seed.type,
    summary: seed.summary,
    score: Math.max(0.55, score),
    role_in_story: seed.role,
    match_reason: '自动注入知识包：用于补足时代、志异母题或 GEARS 资产边界',
    keywords: seed.keywords,
    knowledge_domain: seed.domain,
    entry_role: seed.role,
    ...(seed.era ? { era: seed.era } : {}),
    asset_usage: seed.asset_usage,
    ...(productionPrompts.length ? { production_prompts: productionPrompts } : {}),
    ...(reviewBoundaries.length ? { review_boundaries: reviewBoundaries } : {}),
  };
}

function assetSplitToText(assetSplit: KnowledgeAssetSplit | undefined): string {
  if (!assetSplit) return '';
  return [
    ...assetSplit.characters,
    ...assetSplit.scenes,
    ...assetSplit.character_props,
    ...assetSplit.scene_props,
  ].join(' ');
}
