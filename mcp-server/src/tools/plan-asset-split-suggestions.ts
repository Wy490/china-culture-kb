import type { FullEntryDetail, KnowledgeAssetSplit } from '../types.js';
import { parseEntries, parseFullEntry, readAllProvinceFiles } from '../lib/markdown.js';

type AssetSplitField = keyof KnowledgeAssetSplit;
type SuggestionConfidence = 'high' | 'medium' | 'low';
type ReviewStatus = 'ready_for_editor_review' | 'needs_source_or_location_backfill' | 'low_confidence_hold';

export interface AssetSplitSuggestionItem {
  value: string;
  confidence: SuggestionConfidence;
  evidence: string;
  evidence_field: string;
}

export interface EntryAssetSplitSuggestion {
  entry_name: string;
  province: string;
  region: string;
  type: string;
  source_count: number;
  related_location_count: number;
  confidence_score: number;
  review_status: ReviewStatus;
  warnings: string[];
  suggested_asset_split: {
    characters: AssetSplitSuggestionItem[];
    scenes: AssetSplitSuggestionItem[];
    character_props: AssetSplitSuggestionItem[];
    scene_props: AssetSplitSuggestionItem[];
  };
}

export interface AssetSplitSuggestionReport {
  schema_version: 'kb-asset-split-suggestions/v1';
  generated_at: string;
  totals: {
    files: number;
    entries_scanned: number;
    entries_without_asset_split: number;
    entries_with_suggestions: number;
    ready_for_editor_review: number;
    needs_source_or_location_backfill: number;
    low_confidence_hold: number;
    suggested_characters: number;
    suggested_scenes: number;
    suggested_character_props: number;
    suggested_scene_props: number;
  };
  suggestions: EntryAssetSplitSuggestion[];
  markdown: string;
}

const MAX_ITEMS_PER_FIELD = 6;

const FIELD_LABELS: Record<AssetSplitField, string> = {
  characters: '人物',
  scenes: '场景',
  character_props: '人物随身道具',
  scene_props: '场景陈设',
};

const CHARACTER_PROP_PATTERNS: Array<{ pattern: RegExp; value: string; evidence: string }> = [
  { pattern: /刻刀|雕刀|剪刀/, value: '刻刀/剪刀：手部动作核心道具', evidence: '出现刻刀、雕刀或剪刀' },
  { pattern: /绣针|丝线|绣线|针线/, value: '绣针与丝线：人物手中细部道具', evidence: '出现绣针、丝线或针线' },
  { pattern: /毛笔|笔墨|墨笔/, value: '毛笔：书写或记录道具', evidence: '出现毛笔、笔墨或墨笔' },
  { pattern: /书卷|手稿|卷轴|典籍|书册/, value: '书卷/手稿：人物随身文本道具', evidence: '出现书卷、手稿、卷轴、典籍或书册' },
  { pattern: /印章|印信/, value: '印章：身份或文书道具', evidence: '出现印章或印信' },
  { pattern: /茶刀|茶针|茶篓|茶篮|茶具/, value: '茶具/茶篓：采制茶人物道具', evidence: '出现茶刀、茶针、茶篓、茶篮或茶具' },
  { pattern: /鼓槌|鼓棒/, value: '鼓槌：表演者手持道具', evidence: '出现鼓槌或鼓棒' },
  { pattern: /面具|脸谱/, value: '面具/脸谱：角色外观锚点', evidence: '出现面具或脸谱' },
  { pattern: /药材|药箱|药罐/, value: '药材/药箱：医药人物道具', evidence: '出现药材、药箱或药罐' },
  { pattern: /纸张|宣纸|皮纸|剪纸/, value: '纸张：工艺人物手中材料', evidence: '出现纸张、宣纸、皮纸或剪纸' },
  { pattern: /颜料|染料|靛蓝|蓝靛/, value: '颜料/染料：上色或印染材料', evidence: '出现颜料、染料、靛蓝或蓝靛' },
  { pattern: /木槌|锤|凿|锉|刨/, value: '锤凿工具：雕刻或修整道具', evidence: '出现木槌、锤、凿、锉或刨' },
  { pattern: /船桨|桨/, value: '船桨：水上行动道具', evidence: '出现船桨或桨' },
];

const SCENE_PROP_PATTERNS: Array<{ pattern: RegExp; value: string; evidence: string }> = [
  { pattern: /戏台|舞台|戏楼/, value: '戏台/舞台：表演空间陈设', evidence: '出现戏台、舞台或戏楼' },
  { pattern: /展柜|展陈|展厅|博物馆|纪念馆/, value: '展柜/展陈：纪录片现场陈设', evidence: '出现展柜、展陈、展厅、博物馆或纪念馆' },
  { pattern: /碑刻|石碑|碑文|碑亭/, value: '碑刻/石碑：场景历史锚点', evidence: '出现碑刻、石碑、碑文或碑亭' },
  { pattern: /牌匾|匾额|楹联/, value: '牌匾/楹联：场景身份标识', evidence: '出现牌匾、匾额或楹联' },
  { pattern: /祠堂|宗祠|祖祠/, value: '祠堂陈设：族群记忆空间', evidence: '出现祠堂、宗祠或祖祠' },
  { pattern: /庙|庙会|神龛|香炉/, value: '庙宇/香炉：民俗或信仰场景陈设', evidence: '出现庙、庙会、神龛或香炉' },
  { pattern: /织机|纺车|绷架|绣架/, value: '织机/绣架：工坊固定陈设', evidence: '出现织机、纺车、绷架或绣架' },
  { pattern: /窑|窑炉|炉火|火塘/, value: '窑炉/火塘：工艺空间陈设', evidence: '出现窑、窑炉、炉火或火塘' },
  { pattern: /龙舟|船只|渡船|木船/, value: '船只/龙舟：水域场景陈设', evidence: '出现龙舟、船只、渡船或木船' },
  { pattern: /鼓|铜锣|锣鼓/, value: '锣鼓：仪式或表演场景声画锚点', evidence: '出现鼓、铜锣或锣鼓' },
  { pattern: /石阶|台阶|古道/, value: '石阶/古道：行动路径陈设', evidence: '出现石阶、台阶或古道' },
  { pattern: /书桌|书架|砚台|笔架|灯盏|油灯/, value: '书斋陈设：室内文人空间锚点', evidence: '出现书桌、书架、砚台、笔架、灯盏或油灯' },
  { pattern: /纹样|图案|花纹/, value: '纹样/图案：视觉符号陈设', evidence: '出现纹样、图案或花纹' },
];

export async function planAssetSplitSuggestions(options: { generatedAt?: string } = {}): Promise<AssetSplitSuggestionReport> {
  const allFiles = await readAllProvinceFiles();
  const suggestions: EntryAssetSplitSuggestion[] = [];
  let entriesScanned = 0;
  let entriesWithoutAssetSplit = 0;

  for (const [province, content] of allFiles) {
    const searchEntries = parseEntries(content, province);
    for (const entry of searchEntries) {
      const detail = parseFullEntry(content, entry.name);
      if (!detail) continue;
      entriesScanned += 1;
      if (hasAssetSplit(detail)) continue;
      entriesWithoutAssetSplit += 1;
      const suggestion = suggestAssetSplit(detail);
      if (hasAnySuggestion(suggestion.suggested_asset_split)) {
        suggestions.push(suggestion);
      }
    }
  }

  suggestions.sort((a, b) =>
    reviewStatusWeight(a.review_status) - reviewStatusWeight(b.review_status)
    || b.confidence_score - a.confidence_score
    || a.entry_name.localeCompare(b.entry_name, 'zh-Hans-CN'),
  );

  const base: Omit<AssetSplitSuggestionReport, 'markdown'> = {
    schema_version: 'kb-asset-split-suggestions/v1',
    generated_at: options.generatedAt ?? new Date().toISOString(),
    totals: {
      files: allFiles.size,
      entries_scanned: entriesScanned,
      entries_without_asset_split: entriesWithoutAssetSplit,
      entries_with_suggestions: suggestions.length,
      ready_for_editor_review: suggestions.filter(item => item.review_status === 'ready_for_editor_review').length,
      needs_source_or_location_backfill: suggestions.filter(item => item.review_status === 'needs_source_or_location_backfill').length,
      low_confidence_hold: suggestions.filter(item => item.review_status === 'low_confidence_hold').length,
      suggested_characters: sumField(suggestions, 'characters'),
      suggested_scenes: sumField(suggestions, 'scenes'),
      suggested_character_props: sumField(suggestions, 'character_props'),
      suggested_scene_props: sumField(suggestions, 'scene_props'),
    },
    suggestions,
  };

  return {
    ...base,
    markdown: buildMarkdown(base),
  };
}

function suggestAssetSplit(detail: FullEntryDetail): EntryAssetSplitSuggestion {
  const draft = emptyDraft();
  const signal = entrySignal(detail);
  const usableLocations = usableRelatedLocations(detail);

  suggestCharacters(detail, signal, draft);
  suggestScenes(detail, signal, draft, usableLocations);
  suggestPatternItems(signal, draft);
  ensureTypeFallbacks(detail, signal, draft);

  const sourceCount = detail.sources.length;
  const relatedLocationCount = usableLocations.length;
  const confidenceScore = scoreSuggestion(draft, sourceCount, relatedLocationCount);
  const warnings = buildWarnings(detail, confidenceScore, relatedLocationCount);
  const reviewStatus = statusForSuggestion(confidenceScore, sourceCount, relatedLocationCount);

  return {
    entry_name: detail.name,
    province: detail.province,
    region: detail.region,
    type: detail.type,
    source_count: sourceCount,
    related_location_count: relatedLocationCount,
    confidence_score: confidenceScore,
    review_status: reviewStatus,
    warnings,
    suggested_asset_split: draft,
  };
}

function suggestCharacters(
  detail: FullEntryDetail,
  signal: string,
  draft: EntryAssetSplitSuggestion['suggested_asset_split'],
): void {
  const cleanName = cleanEntryName(detail.name);
  if (/历史人物/.test(detail.type)) {
    addSuggestion(draft, 'characters', `${cleanName}：中心人物资产`, 'high', `条目类型为历史人物，题名为“${detail.name}”`, '类型/题名');
  }

  if (/非遗|传统工艺|饮食文化/.test(detail.type)) {
    addSuggestion(draft, 'characters', '传承人/匠人：制作过程主动作人物', 'medium', `条目类型为${detail.type}`, '类型');
    addSuggestion(draft, 'characters', '学徒/助手：步骤承接与手部动作陪衬', 'low', '生产角色建议，需按实际资料确认是否使用', '类型');
  }

  if (/地方戏曲/.test(detail.type)) {
    addSuggestion(draft, 'characters', '演员/唱腔传承人：表演主体', 'medium', '条目类型为地方戏曲', '类型');
    addSuggestion(draft, 'characters', '乐师：声画节奏支撑人物', 'low', '地方戏曲常见生产角色，需按实际资料确认', '类型');
  }

  if (/民俗活动|节庆习俗/.test(detail.type)) {
    addSuggestion(draft, 'characters', '仪式组织者/主持者：活动流程引导人物', 'medium', `条目类型为${detail.type}`, '类型');
    addSuggestion(draft, 'characters', '参与群众：群像与现场氛围人物', 'medium', `条目类型为${detail.type}`, '类型');
  }

  if (/名胜古迹|地方掌故|宗教信仰/.test(detail.type)) {
    addSuggestion(draft, 'characters', '讲解员/寻访者：当代叙事入口人物', 'low', `条目类型为${detail.type}，建议作为拍摄叙事角色，不写成历史事实`, '类型');
  }

  if (/红军|革命|起义|战役|长征|根据地|苏区/.test(signal)) {
    addSuggestion(draft, 'characters', '革命参与者/见证者：历史事件群像人物', 'medium', firstEvidence(signal, /红军|革命|起义|战役|长征|根据地|苏区/), '正文关键词');
  }
}

function suggestScenes(
  detail: FullEntryDetail,
  signal: string,
  draft: EntryAssetSplitSuggestion['suggested_asset_split'],
  usableLocations: Array<{ name: string; description: string }>,
): void {
  for (const location of usableLocations.slice(0, MAX_ITEMS_PER_FIELD)) {
    const description = location.description ? `：${location.description}` : '';
    addSuggestion(draft, 'scenes', `${location.name}${description}`, 'high', `相关地点：${location.name}${description}`, '相关地点');
  }

  if (usableLocations.length > 0) return;

  if (/非遗|传统工艺|饮食文化/.test(detail.type)) {
    addSuggestion(draft, 'scenes', '工坊/传习所：制作流程场景（待补真实地点）', 'low', `条目类型为${detail.type}但缺相关地点`, '类型');
  }
  if (/地方戏曲/.test(detail.type)) {
    addSuggestion(draft, 'scenes', '戏台/排练场：表演与训练场景（待补真实地点）', 'low', '条目类型为地方戏曲但缺相关地点', '类型');
  }
  if (/民俗活动|节庆习俗/.test(detail.type)) {
    addSuggestion(draft, 'scenes', '村寨广场/活动现场：群体行动场景（待补真实地点）', 'low', `条目类型为${detail.type}但缺相关地点`, '类型');
  }
  if (/名胜古迹/.test(detail.type)) {
    addSuggestion(draft, 'scenes', '遗址/展陈现场：纪录片可拍空间（待补真实地点）', 'low', '条目类型为名胜古迹但缺相关地点', '类型');
  }

  if (/江|河|湖|溪|渡口|码头/.test(signal)) {
    addSuggestion(draft, 'scenes', '水域/渡口空间：行动或空镜场景', 'medium', firstEvidence(signal, /江|河|湖|溪|渡口|码头/), '正文关键词');
  }
  if (/书院|学宫|讲堂|书斋/.test(signal)) {
    addSuggestion(draft, 'scenes', '书院/讲堂空间：文教叙事场景', 'medium', firstEvidence(signal, /书院|学宫|讲堂|书斋/), '正文关键词');
  }
}

function suggestPatternItems(
  signal: string,
  draft: EntryAssetSplitSuggestion['suggested_asset_split'],
): void {
  for (const item of CHARACTER_PROP_PATTERNS) {
    if (item.pattern.test(signal)) {
      addSuggestion(draft, 'character_props', item.value, 'medium', firstEvidence(signal, item.pattern) || item.evidence, '正文关键词');
    }
  }

  for (const item of SCENE_PROP_PATTERNS) {
    if (item.pattern.test(signal)) {
      addSuggestion(draft, 'scene_props', item.value, 'medium', firstEvidence(signal, item.pattern) || item.evidence, '正文关键词');
    }
  }
}

function ensureTypeFallbacks(
  detail: FullEntryDetail,
  signal: string,
  draft: EntryAssetSplitSuggestion['suggested_asset_split'],
): void {
  if (draft.character_props.length === 0 && /非遗|传统工艺|饮食文化/.test(detail.type)) {
    addSuggestion(draft, 'character_props', '制作工具/原材料：需按来源补全名称', 'low', `条目类型为${detail.type}，但正文未抽出稳定工具名`, '类型');
  }
  if (draft.scene_props.length === 0 && /非遗|传统工艺|地方戏曲|民俗活动|节庆习俗/.test(detail.type)) {
    addSuggestion(draft, 'scene_props', '工坊/表演/仪式现场陈设：需按来源补全实物', 'low', `条目类型为${detail.type}，但正文未抽出稳定陈设名`, '类型');
  }
  if (draft.scene_props.length === 0 && /名胜古迹|地方掌故/.test(detail.type)) {
    addSuggestion(draft, 'scene_props', '碑刻/展陈/地标标识：需按现场资料确认', 'low', `条目类型为${detail.type}，但正文未抽出稳定陈设名`, '类型');
  }
  if (draft.character_props.length === 0 && /历史人物/.test(detail.type)) {
    const value = /宋|唐|明|清|民国/.test(signal)
      ? '书卷/文书/随身器物：需按时代资料确认'
      : '随身器物：需按人物时代与来源确认';
    addSuggestion(draft, 'character_props', value, 'low', '历史人物条目需要连续性道具，但正文未抽出稳定物件名', '类型');
  }
}

function addSuggestion(
  draft: EntryAssetSplitSuggestion['suggested_asset_split'],
  field: AssetSplitField,
  value: string,
  confidence: SuggestionConfidence,
  evidence: string,
  evidenceField: string,
): void {
  const list = draft[field];
  if (list.length >= MAX_ITEMS_PER_FIELD) return;
  if (list.some(item => item.value === value)) return;
  list.push({
    value,
    confidence,
    evidence,
    evidence_field: evidenceField,
  });
}

function scoreSuggestion(
  draft: EntryAssetSplitSuggestion['suggested_asset_split'],
  sourceCount: number,
  relatedLocationCount: number,
): number {
  const suggestedCount = draft.characters.length + draft.scenes.length + draft.character_props.length + draft.scene_props.length;
  let score = 30;
  if (sourceCount > 0) score += 20;
  if (relatedLocationCount > 0) score += 20;
  score += Math.min(suggestedCount * 4, 24);
  if (draft.characters.length > 0 && draft.scenes.length > 0) score += 6;
  if (sourceCount === 0) score -= 10;
  if (relatedLocationCount === 0) score -= 10;
  return Math.max(0, Math.min(95, score));
}

function statusForSuggestion(
  confidenceScore: number,
  sourceCount: number,
  relatedLocationCount: number,
): ReviewStatus {
  if (sourceCount === 0 || relatedLocationCount === 0) return 'needs_source_or_location_backfill';
  if (confidenceScore < 45) return 'low_confidence_hold';
  return 'ready_for_editor_review';
}

function buildWarnings(detail: FullEntryDetail, confidenceScore: number, usableLocationCount: number): string[] {
  const warnings: string[] = [];
  if (detail.sources.length === 0) warnings.push('来源为空：建议只能作为待审资产方向，不能直接写成已确认事实。');
  if (usableLocationCount === 0) warnings.push('相关地点为空或仅有交叉引用：场景建议需要先补真实地点、机构、工坊或展陈现场。');
  if (confidenceScore < 45) warnings.push('置信度低：建议先回到来源和正文补充，再生成 asset_split。');
  if (detail.unverifiedPoints.length > 0) warnings.push('存在待核实点：资产拆分不得覆盖或消除待核事实边界。');
  return warnings;
}

function emptyDraft(): EntryAssetSplitSuggestion['suggested_asset_split'] {
  return {
    characters: [],
    scenes: [],
    character_props: [],
    scene_props: [],
  };
}

function entrySignal(detail: FullEntryDetail): string {
  return [
    detail.name,
    detail.province,
    detail.region,
    detail.type,
    detail.summary,
    detail.story,
    detail.culturalSignificance,
    detail.keywords.join('、'),
    detail.relatedLocations.map(location => `${location.name}：${location.description}`).join('\n'),
    detail.sources.join('\n'),
    detail.verificationMethod,
    detail.unverifiedPoints.join('\n'),
  ].filter(Boolean).join('\n');
}

function usableRelatedLocations(detail: FullEntryDetail): Array<{ name: string; description: string }> {
  return detail.relatedLocations
    .map(location => ({
      name: cleanLocationText(location.name),
      description: cleanLocationText(location.description),
    }))
    .filter(location => isUsableLocation(location.name, location.description));
}

function cleanLocationText(value: string): string {
  return value
    .replace(/→.*$/, '')
    .replace(/详见.+$/, '')
    .replace(/\[\[.+?\]\]/g, '')
    .trim();
}

function isUsableLocation(name: string, description: string): boolean {
  if (!name) return false;
  const combined = `${name} ${description}`;
  if (/^\[S\d+\]/.test(name)) return false;
  if (/来源|资料|官方资料|参考|详见|\[\[|\]\]/.test(combined)) return false;
  if (/^https?:\/\//.test(name)) return false;
  return true;
}

function hasAssetSplit(detail: FullEntryDetail): boolean {
  const assetSplit = detail.asset_split;
  return Boolean(
    assetSplit?.characters.length
    && assetSplit.scenes.length
    && assetSplit.character_props.length
    && assetSplit.scene_props.length,
  );
}

function hasAnySuggestion(suggestions: EntryAssetSplitSuggestion['suggested_asset_split']): boolean {
  return suggestions.characters.length > 0
    || suggestions.scenes.length > 0
    || suggestions.character_props.length > 0
    || suggestions.scene_props.length > 0;
}

function confidenceLabel(score: number): SuggestionConfidence {
  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

function cleanEntryName(name: string): string {
  return name
    .replace(/——.+$/, '')
    .replace(/（.+?）/g, '')
    .trim();
}

function firstEvidence(signal: string, pattern: RegExp): string {
  const source = signal.replace(/\s+/g, ' ');
  const index = source.search(pattern);
  if (index === -1) return '';
  const start = Math.max(0, index - 18);
  const end = Math.min(source.length, index + 36);
  return source.slice(start, end).trim();
}

function sumField(suggestions: EntryAssetSplitSuggestion[], field: AssetSplitField): number {
  return suggestions.reduce((sum, item) => sum + item.suggested_asset_split[field].length, 0);
}

function reviewStatusWeight(status: ReviewStatus): number {
  if (status === 'ready_for_editor_review') return 1;
  if (status === 'needs_source_or_location_backfill') return 2;
  return 3;
}

function buildMarkdown(report: Omit<AssetSplitSuggestionReport, 'markdown'>): string {
  const lines: string[] = [
    '# Asset Split 建议报告',
    '',
    `生成时间：${report.generated_at}`,
    '',
    '## 总览',
    '',
    `- 省份文件：${report.totals.files}`,
    `- 扫描条目：${report.totals.entries_scanned}`,
    `- 缺 asset_split 条目：${report.totals.entries_without_asset_split}`,
    `- 已生成建议条目：${report.totals.entries_with_suggestions}`,
    `- 可进入编辑审稿：${report.totals.ready_for_editor_review}`,
    `- 需要先补来源/地点：${report.totals.needs_source_or_location_backfill}`,
    `- 低置信度暂缓：${report.totals.low_confidence_hold}`,
    `- 建议人物：${report.totals.suggested_characters}`,
    `- 建议场景：${report.totals.suggested_scenes}`,
    `- 建议人物随身道具：${report.totals.suggested_character_props}`,
    `- 建议场景陈设：${report.totals.suggested_scene_props}`,
    '',
    '## 执行原则',
    '',
    '- 本报告只给 asset_split 候选，不自动写回省份 Markdown。',
    '- 来源或相关地点为空的条目，先做来源/地点回溯，再把建议转成正式生产资产。',
    '- 人物、场景、道具、陈设必须分开；生产角色不得写成历史事实。',
    '- 置信度来自本地正文、来源数量和相关地点数量，不等同于事实可靠性。',
    '',
    '## 优先建议',
    '',
    '| 条目 | 省份 | 类型 | 分数 | 状态 | 人物 | 场景 | 道具 | 陈设 | 风险 |',
    '|---|---|---|---:|---|---|---|---|---|---|',
    ...report.suggestions.slice(0, 50).map(item => [
      item.entry_name,
      item.province,
      item.type,
      String(item.confidence_score),
      statusLabel(item.review_status),
      summarizeField(item.suggested_asset_split.characters),
      summarizeField(item.suggested_asset_split.scenes),
      summarizeField(item.suggested_asset_split.character_props),
      summarizeField(item.suggested_asset_split.scene_props),
      item.warnings.join('；') || '无',
    ].map(escapeTableCell).join(' | ')).map(row => `| ${row} |`),
    '',
    '## 样例明细',
  ];

  for (const item of report.suggestions.slice(0, 12)) {
    lines.push(
      '',
      `### ${item.entry_name}`,
      '',
      `- 省份/类型：${item.province} / ${item.type}`,
      `- 置信分：${item.confidence_score}（${confidenceLabel(item.confidence_score)}）`,
      `- 审稿状态：${statusLabel(item.review_status)}`,
      `- 风险提示：${item.warnings.join('；') || '无'}`,
    );

    for (const field of ['characters', 'scenes', 'character_props', 'scene_props'] as const) {
      lines.push('', `**${FIELD_LABELS[field]}**`);
      const values = item.suggested_asset_split[field];
      if (values.length === 0) {
        lines.push('- 暂无稳定建议');
      } else {
        lines.push(...values.map(value => `- ${value.value}（${value.confidence}；${value.evidence_field}：${value.evidence}）`));
      }
    }
  }

  lines.push(
    '',
    '## 下一步',
    '',
    '- 对 ready_for_editor_review 条目，人工抽查后可补进省份 Markdown 的 asset_split 四段。',
    '- 对 needs_source_or_location_backfill 条目，先执行 source_location_backfill 批次。',
    '- 补完后重新运行 kb:production-audit、kb:production-upgrade-plan 和 kb:lint。',
  );

  return `${lines.join('\n')}\n`;
}

function summarizeField(items: AssetSplitSuggestionItem[]): string {
  if (items.length === 0) return '';
  return items.slice(0, 2).map(item => item.value).join('；');
}

function statusLabel(status: ReviewStatus): string {
  if (status === 'ready_for_editor_review') return '可审稿';
  if (status === 'needs_source_or_location_backfill') return '先补来源/地点';
  return '低置信暂缓';
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, '/').replace(/\n/g, ' ');
}
