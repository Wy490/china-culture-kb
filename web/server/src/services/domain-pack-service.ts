import type {
  EntryDetail,
  EntrySearchResult,
  KnowledgeAssetUsage,
  KnowledgeDomain,
  KnowledgeEntryRole,
  KnowledgePackEntry,
} from '@shared/types.js';

interface EntryMetadata {
  knowledge_domain: KnowledgeDomain;
  entry_role: KnowledgeEntryRole;
  era?: string;
  asset_usage?: KnowledgeAssetUsage[];
}

interface DomainPackSeed {
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
}

const DYNASTY_ERAS = [
  '先秦',
  '秦',
  '汉',
  '三国',
  '晋',
  '南北朝',
  '隋',
  '唐',
  '五代',
  '宋',
  '北宋',
  '南宋',
  '元',
  '明',
  '清',
  '民国',
  '近代',
  '现代',
];

const DOMAIN_PACK_SEEDS: DomainPackSeed[] = [
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

export function inferEntryMetadata(entry: Pick<EntrySearchResult, 'name' | 'type' | 'summary' | 'keywords' | 'province' | 'region'>): EntryMetadata {
  const text = `${entry.name} ${entry.type} ${entry.summary} ${entry.keywords.join(' ')} ${entry.province} ${entry.region}`;
  const era = detectEra(text);
  const assetUsage = inferAssetUsage(text, entry.type);
  return {
    knowledge_domain: inferKnowledgeDomain(text, entry.type),
    entry_role: 'core_entry',
    ...(era ? { era } : {}),
    ...(assetUsage.length > 0 ? { asset_usage: assetUsage } : {}),
  };
}

export function enrichSearchResultWithMetadata(entry: EntrySearchResult): EntrySearchResult {
  return {
    ...entry,
    ...inferEntryMetadata(entry),
  };
}

export function enrichEntryDetailWithMetadata(entry: EntryDetail): EntryDetail {
  return {
    ...entry,
    ...inferEntryMetadata(entry),
  };
}

export function buildDomainPackEntries(context: {
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
    ].join(' ') : '',
    ...(context.knowledgePackEntries ?? []).map(entry => `${entry.entry_name} ${entry.summary} ${entry.keywords.join(' ')}`),
  ].filter(Boolean).join(' ');
  if (!text.trim()) return [];

  const selected = DOMAIN_PACK_SEEDS
    .map(seed => ({ seed, score: scoreDomainPackSeed(seed, text) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, context.limit ?? 4);

  return selected.map(({ seed, score }) => seedToKnowledgePackEntry(seed, score));
}

export function appendDomainPackEntries(
  supportingEntries: KnowledgePackEntry[],
  context: {
    query?: string;
    entry?: EntryDetail;
    primaryEntries?: KnowledgePackEntry[];
    limit?: number;
  },
): KnowledgePackEntry[] {
  const generated = buildDomainPackEntries({
    query: context.query,
    entry: context.entry,
    knowledgePackEntries: [...(context.primaryEntries ?? []), ...supportingEntries],
    limit: context.limit,
  });
  const existingNames = new Set(supportingEntries.map(entry => entry.entry_name));
  return [
    ...supportingEntries,
    ...generated.filter(entry => !existingNames.has(entry.entry_name)),
  ];
}

function inferKnowledgeDomain(text: string, type: string): KnowledgeDomain {
  if (type === '神话传说' || type === '民间故事' || /志异|狐|鬼|妖|怪|神话|传说|显灵|托梦/.test(text)) {
    return 'folklore_zhiyi';
  }
  if (/地域|地方|省|县|府|州|村|山|湖|江|河/.test(type) || /地域|地方|民俗/.test(text)) {
    return 'regional_culture';
  }
  return 'core_china_culture';
}

function inferAssetUsage(text: string, type: string): KnowledgeAssetUsage[] {
  const usage = new Set<KnowledgeAssetUsage>();
  if (type === '历史人物' || /人物|士人|书生|官员|僧|道士|少年|服饰|发式/.test(text)) usage.add('character_clothing');
  if (/书|笔|印章|信|伞|手稿|书卷|铜铃/.test(text)) usage.add('character_props');
  if (/洞|书院|衙|寺|庙|祠|楼|阁|亭|桥|山|湖|江|河|街|村|庭院/.test(text)) usage.add('scene_space');
  if (/案卷|判词|油灯|烛火|香炉|石阶|岩壁|书桌|陈设|道具/.test(text)) usage.add('scene_props');
  if (/传说|神话|志异|狐|鬼|妖|怪|托梦|显灵|报恩|禁忌/.test(text)) usage.add('story_motif');
  if (/可信|待核实|存疑|民间传说|文学|史实|附会/.test(text)) usage.add('credibility_boundary');
  return [...usage];
}

function detectEra(text: string): string | undefined {
  const matched = DYNASTY_ERAS.find(era => text.includes(era));
  if (matched) return matched;
  if (/周敦颐|濂溪|理学|太极图说|爱莲说/.test(text)) return '宋';
  if (/柳毅|唐传奇/.test(text)) return '唐';
  if (/毛泽东|刘少奇|彭德怀|革命|抗战|民国/.test(text)) return '近现代';
  return undefined;
}

function scoreDomainPackSeed(seed: DomainPackSeed, text: string): number {
  let score = 0;
  for (const word of seed.trigger_words) {
    if (word && text.includes(word)) score += word.length >= 3 ? 0.2 : 0.12;
  }
  if (seed.era && text.includes(seed.era)) score += 0.2;
  return Math.min(1, Math.round(score * 100) / 100);
}

function seedToKnowledgePackEntry(seed: DomainPackSeed, score: number): KnowledgePackEntry {
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
  };
}
