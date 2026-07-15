import type {
  EntryDetail,
  EntrySearchResult,
  KnowledgeAssetSplit,
  KnowledgeAssetUsage,
  KnowledgeDomain,
  KnowledgeEntryRole,
} from '@shared/types.js';

export interface ChinaCultureEntryMetadata {
  knowledge_domain: KnowledgeDomain;
  entry_role: KnowledgeEntryRole;
  era?: string;
  asset_usage?: KnowledgeAssetUsage[];
  asset_split?: KnowledgeAssetSplit;
}

const CHINA_CULTURE_DYNASTY_ERAS = [
  '先秦', '秦', '汉', '三国', '晋', '南北朝', '隋', '唐', '五代',
  '宋', '北宋', '南宋', '元', '明', '清', '民国', '近代', '现代',
];

export function inferChinaCultureEntryMetadata(
  entry: Pick<EntrySearchResult, 'name' | 'type' | 'summary' | 'keywords' | 'province' | 'region'>,
): ChinaCultureEntryMetadata {
  const text = `${entry.name} ${entry.type} ${entry.summary} ${entry.keywords.join(' ')} ${entry.province} ${entry.region}`;
  const era = detectChinaCultureEra(text);
  const assetUsage = inferChinaCultureAssetUsage(text, entry.type);
  return {
    knowledge_domain: inferChinaCultureKnowledgeDomain(text, entry.type),
    entry_role: 'core_entry',
    ...(era ? { era } : {}),
    ...(assetUsage.length > 0 ? { asset_usage: assetUsage } : {}),
  };
}

export function enrichChinaCultureSearchResultWithMetadata(entry: EntrySearchResult): EntrySearchResult {
  const inferred = inferChinaCultureEntryMetadata(entry);
  return {
    ...entry,
    knowledge_domain: entry.knowledge_domain ?? inferred.knowledge_domain,
    entry_role: entry.entry_role ?? inferred.entry_role,
    era: entry.era ?? inferred.era,
    asset_usage: entry.asset_usage ?? inferred.asset_usage,
    asset_split: entry.asset_split ?? inferred.asset_split,
  };
}

export function enrichChinaCultureEntryDetailWithMetadata(entry: EntryDetail): EntryDetail {
  const inferred = inferChinaCultureEntryMetadata(entry);
  return {
    ...entry,
    knowledge_domain: entry.knowledge_domain ?? inferred.knowledge_domain,
    entry_role: entry.entry_role ?? inferred.entry_role,
    era: entry.era ?? inferred.era,
    asset_usage: entry.asset_usage ?? inferred.asset_usage,
    asset_split: entry.asset_split ?? inferred.asset_split,
  };
}

export function inferChinaCultureKnowledgeDomain(text: string, type: string): KnowledgeDomain {
  if (/叙事模式|叙事机制|narrative|剧情结构|节奏结构/.test(text)) return 'narrative_pattern';
  if (/人物原型|角色原型|archetype|清官|匠人|见证者/.test(text)) return 'character_archetype';
  if (/冲突模式|冲突机制|conflict|冤案|抉择|对抗/.test(text)) return 'conflict_pattern';
  if (/视觉风格|画风|镜头风格|visual style|分镜风格/.test(text)) return 'visual_style_pack';
  if (/安全规则|红线|不可写成|禁写|风险规则/.test(text)) return 'safety_rule';
  if (/来源包|来源体系|source pack|引用边界|资料来源/.test(text)) return 'source_pack';
  if (type === '神话传说' || type === '民间故事' || /志异|狐|鬼|妖|怪|神话|传说|显灵|托梦/.test(text)) {
    return 'folklore_zhiyi';
  }
  if (/地域|地方|省|县|府|州|村|山|湖|江|河/.test(type) || /地域|地方|民俗/.test(text)) {
    return 'regional_culture';
  }
  return 'core_china_culture';
}

export function inferChinaCultureAssetUsage(text: string, type: string): KnowledgeAssetUsage[] {
  const usage = new Set<KnowledgeAssetUsage>();
  if (type === '历史人物' || /人物|士人|书生|官员|僧|道士|少年|服饰|发式/.test(text)) usage.add('character_clothing');
  if (/书|笔|印章|信|伞|手稿|书卷|铜铃/.test(text)) usage.add('character_props');
  if (/洞|书院|衙|寺|庙|祠|楼|阁|亭|桥|山|湖|江|河|街|村|庭院/.test(text)) usage.add('scene_space');
  if (/案卷|判词|油灯|烛火|香炉|石阶|岩壁|书桌|陈设|道具/.test(text)) usage.add('scene_props');
  if (/传说|神话|志异|狐|鬼|妖|怪|托梦|显灵|报恩|禁忌/.test(text)) usage.add('story_motif');
  if (/可信|待核实|存疑|民间传说|文学|史实|附会/.test(text)) usage.add('credibility_boundary');
  if (/叙事|剧情结构|节奏|起承转合|开场|反转|结尾/.test(text)) usage.add('plot_structure');
  if (/成长|人物弧|选择|转变|人格|原型/.test(text)) usage.add('character_arc');
  if (/冲突|对抗|阻力|抉择|冤案|争议/.test(text)) usage.add('conflict_engine');
  if (/视觉|画风|镜头|分镜|水墨|漫画|展陈/.test(text)) usage.add('visual_style');
  if (/红线|不可写成|禁写|安全|风险|边界/.test(text)) usage.add('safety_boundary');
  if (/来源|引用|地方志|专著|展陈|一手文献/.test(text)) usage.add('source_grounding');
  return [...usage];
}

export function detectChinaCultureEra(text: string): string | undefined {
  const matched = CHINA_CULTURE_DYNASTY_ERAS.find(era => text.includes(era));
  if (matched) return matched;
  if (/周敦颐|濂溪|理学|太极图说|爱莲说/.test(text)) return '宋';
  if (/柳毅|唐传奇/.test(text)) return '唐';
  if (/毛泽东|刘少奇|彭德怀|革命|抗战|民国/.test(text)) return '近现代';
  return undefined;
}
