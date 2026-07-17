import type {
  GearsAgeRange,
  GearsCharacterAsset,
  GearsCharacterGenderSummary,
  GearsCharacterRolePosition,
  GearsGender,
  GearsDeliveryPackage,
  GearsDeliveryStatus,
  GearsDeliveryUnit,
  GearsSceneAsset,
  GearsSceneAtmosphere,
  GearsSceneType,
  GearsTimeOfDay,
  KnowledgePackEntry,
  PanelCount,
  StoryCharacter,
  StoryGenerateResult,
  StoryScene,
} from '@shared/types.js';
import { resolveStorySourceDomain } from '../platform/story-source-domain.js';

const VALID_PANEL_COUNTS: PanelCount[] = [4, 6, 8, 9, 10, 12];

export function buildGearsDeliveryPackage(story: StoryGenerateResult): GearsDeliveryPackage {
  const characterAssets = buildCharacterAssets(story);
  const characterGenderSummary = summarizeCharacterGenders(characterAssets);
  const sceneAssets = buildSceneAssets(story);
  const units = buildDeliveryUnits(story, characterAssets);
  const validationNotes = [
    ...validateDeliveryPackage(characterAssets, sceneAssets, units),
    ...validateProductionMaterialReadiness(story.production_material_readiness),
  ];
  const pkgWithoutMarkdown = {
    schema_version: 'gears-delivery/v1',
    storyId: story.storyId,
    sourceDomain: resolveStorySourceDomain(story),
    title: story.title,
    delivery_status: deriveDeliveryStatus(validationNotes),
    character_assets: characterAssets,
    character_gender_summary: characterGenderSummary,
    scene_assets: sceneAssets,
    units,
    validation_notes: validationNotes,
  };

  return {
    ...pkgWithoutMarkdown,
    markdown: renderDeliveryMarkdown(pkgWithoutMarkdown),
  };
}

export function ensureGearsDeliveryPackage(story: StoryGenerateResult): GearsDeliveryPackage {
  const current = story.gears_delivery as Partial<GearsDeliveryPackage> | undefined;
  if (!current) return buildGearsDeliveryPackage(story);

  const fresh = buildGearsDeliveryPackage(story);
  const characterAssets = mergeCharacterAssets(current.character_assets, fresh.character_assets);
  const sceneAssets = current.scene_assets?.length ? current.scene_assets : fresh.scene_assets;
  const units = mergeDeliveryUnits(current.units, fresh.units);
  const validationNotes = [
    ...validateDeliveryPackage(characterAssets, sceneAssets, units),
    ...validateProductionMaterialReadiness(story.production_material_readiness),
  ];
  const pkgWithoutMarkdown: Omit<GearsDeliveryPackage, 'markdown'> = {
    schema_version: current.schema_version ?? fresh.schema_version,
    storyId: current.storyId ?? fresh.storyId,
    sourceDomain: fresh.sourceDomain,
    title: current.title ?? fresh.title,
    delivery_status: deriveDeliveryStatus(validationNotes),
    character_assets: characterAssets,
    character_gender_summary: summarizeCharacterGenders(characterAssets),
    scene_assets: sceneAssets,
    units,
    validation_notes: validationNotes,
  };
  const shouldKeepMarkdown = Boolean(current.markdown?.includes('# 人物性别统计'))
    && current.markdown?.includes(`> sourceDomain: ${pkgWithoutMarkdown.sourceDomain}`) === true
    && areGenderSummariesEqual(current.character_gender_summary, pkgWithoutMarkdown.character_gender_summary)
    && areStringArraysEqual(current.validation_notes, pkgWithoutMarkdown.validation_notes);
  const markdown = shouldKeepMarkdown && current.markdown
    ? current.markdown
    : renderDeliveryMarkdown(pkgWithoutMarkdown);

  return {
    ...pkgWithoutMarkdown,
    markdown,
  };
}

function mergeDeliveryUnits(
  currentUnits: GearsDeliveryUnit[] | undefined,
  freshUnits: GearsDeliveryUnit[],
): GearsDeliveryUnit[] {
  if (!currentUnits?.length) return freshUnits;
  const freshById = new Map(freshUnits.map(unit => [unit.unit_id, unit]));
  return currentUnits.map((unit) => {
    const fresh = freshById.get(unit.unit_id);
    if (!fresh) return unit;
    return {
      ...fresh,
      ...unit,
      visual_prompt: unit.visual_prompt ?? fresh.visual_prompt,
      camera_suggestion: unit.camera_suggestion ?? fresh.camera_suggestion,
      segment_prompt_hint: unit.segment_prompt_hint ?? fresh.segment_prompt_hint,
      constraint_note: unit.constraint_note?.length
        ? unit.constraint_note
        : fresh.constraint_note,
    };
  });
}

function areStringArraysEqual(left: string[] | undefined, right: string[]): boolean {
  if (!left) return right.length === 0;
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function mergeCharacterAssets(
  currentAssets: GearsCharacterAsset[] | undefined,
  freshAssets: GearsCharacterAsset[],
): GearsCharacterAsset[] {
  if (!currentAssets?.length) return freshAssets;

  const freshByName = new Map(freshAssets.map(asset => [asset.name, asset]));
  const merged = currentAssets.map(asset => {
    const fresh = freshByName.get(asset.name);
    return {
      ...(fresh ?? asset),
      ...asset,
      gender: normalizeGender(asset.gender, fresh?.gender),
    };
  });
  const currentNames = new Set(merged.map(asset => asset.name));
  for (const fresh of freshAssets) {
    if (!currentNames.has(fresh.name)) merged.push(fresh);
  }
  return merged;
}

function normalizeGender(value: unknown, fallback: GearsGender | undefined): GearsGender {
  if (isGearsGender(value) && value !== '未指定') return value;
  return fallback ?? (isGearsGender(value) ? value : '未指定');
}

function isGearsGender(value: unknown): value is GearsGender {
  return ['男', '女', '其他', '未指定', '不适用'].includes(String(value));
}

function areGenderSummariesEqual(
  current: GearsCharacterGenderSummary | undefined,
  next: GearsCharacterGenderSummary,
): boolean {
  if (!current) return false;
  return current.total === next.total
    && current.male === next.male
    && current.female === next.female
    && current.other === next.other
    && current.unspecified === next.unspecified
    && current.not_applicable === next.not_applicable;
}

function buildCharacterAssets(story: StoryGenerateResult): GearsCharacterAsset[] {
  const characterMap = new Map<string, StoryCharacter | undefined>();
  for (const character of story.characters ?? []) {
    const name = normalizeCharacterName(character.name);
    if (name) characterMap.set(name, character);
  }
  for (const scene of story.scene_breakdown) {
    for (const name of scene.characters ?? []) {
      const normalizedName = normalizeCharacterName(name);
      if (!normalizedName || isLikelyNonCharacterName(normalizedName, story)) continue;
      characterMap.set(normalizedName, characterMap.get(normalizedName));
    }
  }

  const storyContext = buildStoryContext(story);

  return [...characterMap.entries()].map(([name, character], index) => ({
    ...buildCharacterAsset(story, storyContext, name, character, index),
  }));
}

function buildCharacterAsset(
  story: StoryGenerateResult,
  storyContext: string,
  name: string,
  character: StoryCharacter | undefined,
  index: number,
): GearsCharacterAsset {
  const characterScenes = story.scene_breakdown.filter(scene => scene.characters?.includes(name));
  const knowledgeKeys = story.source_entry.includes(name) ? [name, story.source_entry] : [name];
  const characterContext = [
    character?.description,
    character?.arc,
    ...findKnowledgeSnippets(story, knowledgeKeys),
    ...findSupplementSnippets(story, [name]),
    ...characterScenes.flatMap(scene => [
      scene.title,
      scene.plot,
      scene.cultural_note,
      scene.factual_basis,
      ...(scene.fictionalized_elements ?? []),
    ]),
  ].filter(Boolean).join(' ');
  const carriedProps = inferCarriedProps(characterContext);
  const appearanceFeatures = character?.description?.trim()
    || detailSentence(name, characterContext, 1)
    || `${name}的稳定外观需按史料或项目设定补充；保持五官、发型、体型与显著特征在所有单元一致。`;

  return {
    name,
    role_position: mapRolePosition(character?.role, index),
    species_type: '人类',
    ethnicity: ['东亚'],
    gender: inferGender(name, character?.description ?? characterContext),
    age_range: inferAgeRange(name, character?.description ?? characterContext),
    appearance_features: appearanceFeatures,
    clothing: inferClothing(name, `${characterContext} ${storyContext}`),
    ...(carriedProps ? { carried_props: carriedProps, signature_objects: carriedProps } : {}),
    ...(character?.arc
      ? { background_oneliner: character.arc }
      : detailSentence(name, characterContext, 1)
        ? { background_oneliner: detailSentence(name, characterContext, 1) }
        : {}),
  };
}

const COLLECTIVE_CHARACTER_TERMS = [
  '群体', '百姓', '众人', '村民', '乡民', '学生们', '孩子们', '人群',
  '学员', '骨干', '群众', '协会成员', '农民们',
];

function isCollectiveCharacterName(name: string): boolean {
  return COLLECTIVE_CHARACTER_TERMS.some(word => name.includes(word));
}

function inferGender(name: string, text: string): GearsGender {
  const nameGender = inferGenderFromText(name, true);
  if (nameGender !== '未指定') return nameGender;
  return inferGenderFromText(text, false);
}

function inferGenderFromText(text: string, allowGroupTerms: boolean): GearsGender {
  if (allowGroupTerms && isCollectiveCharacterName(text)) {
    return '不适用';
  }
  if (['杨开慧', '老奶奶', '老婆婆', '老妇人', '阿婆', '少女', '姑娘', '女子', '女儿', '母亲', '郑氏', '狐女', '龙女', '女鬼'].some(word => text.includes(word))) {
    return '女';
  }
  if (['毛贻昌', '萧子升', '杨昌济', '蔡和森', '老人', '老者', '老先生', '少年', '书童', '船夫', '艄公', '渔父', '渔夫', '县令', '知县', '道士', '道人', '僧人', '和尚', '父亲', '上官', '王逵', '周敦颐', '毛泽东'].some(word => text.includes(word))) {
    return '男';
  }
  if (['性别：女', '性别: 女', '女性', '女，', '女；', '女)'].some(word => text.includes(word))) return '女';
  if (['性别：男', '性别: 男', '男性', '男，', '男；', '男)'].some(word => text.includes(word))) return '男';
  if (['其他性别', '非二元', '性别：其他', '性别: 其他'].some(word => text.includes(word))) return '其他';
  return '未指定';
}

function summarizeCharacterGenders(characters: GearsCharacterAsset[]): GearsCharacterGenderSummary {
  const summary: GearsCharacterGenderSummary = {
    total: characters.length,
    male: 0,
    female: 0,
    other: 0,
    unspecified: 0,
    not_applicable: 0,
  };
  for (const character of characters) {
    if (character.gender === '男') summary.male += 1;
    else if (character.gender === '女') summary.female += 1;
    else if (character.gender === '其他') summary.other += 1;
    else if (character.gender === '不适用') summary.not_applicable += 1;
    else summary.unspecified += 1;
  }
  return summary;
}

function mapRolePosition(role: string | undefined, index: number): GearsCharacterRolePosition {
  const normalized = role ?? '';
  if (index === 0 || ['主角', 'protagonist', 'main'].some(key => normalized.includes(key))) return '主角';
  if (['反派', 'antagonist', 'opponent'].some(key => normalized.includes(key))) return '反派';
  if (['群演', 'crowd'].some(key => normalized.includes(key))) return '群演';
  if (['路人', 'passerby'].some(key => normalized.includes(key))) return '路人';
  return '配角';
}

function inferAgeRange(name: string, text: string): GearsAgeRange {
  if (isCollectiveCharacterName(name)) return '不适用';
  const knownAges: Record<string, GearsAgeRange> = {
    毛泽东: '青年',
    毛贻昌: '中年',
    萧子升: '青年',
    杨昌济: '中年',
    蔡和森: '青年',
    杨开慧: '青年',
  };
  if (knownAges[name]) return knownAges[name];
  if (text.includes('父亲') || text.includes('母亲') || text.includes('师长') || text.includes('老师')) return '中年';
  if (text.includes('儿童') || text.includes('孩子')) return '儿童';
  if (text.includes('少年') && text.includes('青年')) return '青年';
  if (text.includes('少年')) return '少年';
  if (text.includes('青年') || text.includes('求学')) return '青年';
  if (text.includes('中年')) return '中年';
  if (text.includes('老年') || text.includes('晚年')) return '老年';
  return '青年';
}

function inferClothing(name: string, text: string): string {
  if (name === '毛泽东') {
    return '按清末民初至1920年代的场次年龄推进：韶山少年阶段穿湖南农家短褂布裤；一师求学与新民学会阶段穿朴素学生长衫或学生装；农民运动阶段穿便于乡村行走的布质长衫、短褂与布鞋，发式和年龄随年代一致。';
  }
  if (name === '毛贻昌') {
    return '清末湖南中年农家经营者服装：深色棉麻对襟短褂、宽腿布裤、布鞋，不使用学生装。';
  }
  if (name === '杨昌济') {
    return '民国初年中年学者教师服装：素色长衫、布鞋，仪容稳重，不使用少年学生造型。';
  }
  if (['萧子升', '蔡和森'].includes(name)) {
    return '1910年代湖南青年学生服装：朴素长衫或学生装、布鞋，发式符合民国初年青年形象。';
  }
  if (name === '杨开慧') {
    return '1920年代湖南青年女性知识分子服装：素色上衣与长裙或布裤、布鞋，发式简洁，符合农民夜校教学场景。';
  }
  if (isCollectiveCharacterName(name) && name.includes('农民')) {
    return '1920年代湖南农民群体服装：棉麻短褂、布裤、草鞋或布鞋，按个体做旧差异，不使用统一学生装。';
  }
  if (['周敦颐', '濂溪', '理学', '太极图说', '爱莲说', '宋', '北宋'].some(word => text.includes(word))) {
    return '北宋士人或少年读书人固定服装：素色交领长衫或圆领袍，布履，头发束起，所有单元保持一致。';
  }
  if (/(毛泽东|韶山|湘潭|第一师范|东山|辛亥|五四|新文化|马克思|革命|近代|民国|清末|191\d|192\d)/.test(text)) {
    return '清末民初至五四前后中国青年固定服装：朴素学生长衫或短褂布鞋，发式按近代青年处理，所有单元保持一致。';
  }
  if (text.includes('唐') || text.includes('宋') || text.includes('明') || text.includes('清') || text.includes('古代')) {
    return '符合对应历史时期与身份的固定服装，所有单元保持一致。';
  }
  return '符合人物身份与时代背景的固定服装，所有单元保持一致。';
}

function inferCarriedProps(text: string): string | undefined {
  const candidates = ['旧信', '书信', '手稿', '书', '竹简', '毛笔', '笔', '印章', '伞', '拐杖', '铜铃'];
  const environmentOnly = ['天然溶洞', '溶洞', '洞口', '岩壁', '石壁', '石阶', '书院', '军衙', '庭院', '溪水', '碑刻', '香炉', '案卷', '卷宗', '文书', '判词'];
  const matched = candidates.filter(item => text.includes(item));
  const filtered = matched.filter(item => !environmentOnly.some(blocked => blocked.includes(item) && text.includes(blocked)));
  return filtered.length > 0 ? [...new Set(filtered)].slice(0, 3).join('、') : undefined;
}

function buildSceneAssets(story: StoryGenerateResult): GearsSceneAsset[] {
  const sceneMap = new Map<string, StoryScene[]>();
  const scenes = story.scene_breakdown;
  for (const scene of scenes) {
    const name = normalizeSceneName(scene.location || scene.title || `场景${scene.scene_id}`, scene);
    sceneMap.set(name, [...(sceneMap.get(name) ?? []), scene]);
  }

  return [...sceneMap.entries()].map(([name, relatedScenes]) => {
    const rawDescriptionParts = relatedScenes.flatMap(scene => compactStrings([
      scene.location,
      scene.visual_prompt,
      ...findKnowledgeSnippets(story, [
        name,
        scene.location,
        scene.title,
        ...(scene.source_entries ?? []),
      ]),
      ...findSupplementSnippets(story, [
        name,
        scene.location,
        scene.title,
        ...(scene.characters ?? []),
      ]),
      scene.factual_basis,
      scene.cultural_note,
      scene.plot,
    ]));
    const descriptionParts = filterSceneDescriptionParts(name, rawDescriptionParts);
    const supplementalSceneParts = compactStrings([
      story.spatial_identity,
      story.time_layer,
      story.atmosphere,
      ...(story.visual_route ?? []),
      ...(story.visual_symbols ?? []),
    ]);

    return {
      name,
      scene_type: inferSceneType(name, [...descriptionParts, ...supplementalSceneParts].join(' ')),
      description: buildSceneDescription(name, [...descriptionParts, ...supplementalSceneParts])
        || `${name}的空间结构、材质、主要陈设和环境氛围需由供稿侧补充。`,
      ...(inferEnvironmentProps(name, descriptionParts.join(' ')) ? { environment_props: inferEnvironmentProps(name, descriptionParts.join(' ')) } : {}),
      atmosphere: inferAtmosphere(relatedScenes),
    };
  });
}

function compactStrings(values: Array<string | undefined>): string[] {
  return values
    .map(value => value?.trim())
    .filter((value): value is string => Boolean(value));
}

function buildStoryContext(story: StoryGenerateResult): string {
  return [
    story.title,
    story.logline,
    story.theme,
    story.full_text,
    story.core_message,
    story.slogan_or_key_sentence,
    story.craft_or_ritual_process,
    story.modern_connection,
    story.spatial_identity,
    story.time_layer,
    story.atmosphere,
    ...(story.visual_symbols ?? []),
    ...(story.visual_route ?? []),
    ...story.scene_breakdown.map(scene => [
      scene.title,
      scene.location,
      scene.plot,
      scene.cultural_note,
      scene.factual_basis,
      ...(scene.source_entries ?? []),
    ].filter(Boolean).join(' ')),
    ...knowledgeEntries(story).map(entryToText),
    ...supplementEntries(story),
  ].filter(Boolean).join(' ');
}

function knowledgeEntries(story: StoryGenerateResult): KnowledgePackEntry[] {
  return [
    ...(story.knowledge_pack?.primary_entries ?? []),
    ...(story.knowledge_pack?.supporting_entries ?? []),
  ];
}

function entryToText(entry: KnowledgePackEntry): string {
  return [
    entry.entry_name,
    entry.province,
    entry.region,
    entry.type,
    entry.summary,
    entry.role_in_story,
    entry.match_reason,
    ...entry.keywords,
    ...(entry.asset_split?.characters ?? []),
    ...(entry.asset_split?.scenes ?? []),
    ...(entry.asset_split?.character_props ?? []),
    ...(entry.asset_split?.scene_props ?? []),
  ].filter(Boolean).join(' ');
}

function findKnowledgeSnippets(story: StoryGenerateResult, needles: Array<string | undefined>): string[] {
  const normalizedNeedles = needles
    .map(needle => needle?.trim())
    .filter((needle): needle is string => Boolean(needle));
  if (normalizedNeedles.length === 0) return [];

  return knowledgeEntries(story)
    .filter(entry => {
      const text = entryToText(entry);
      return normalizedNeedles.some(needle => text.includes(needle) || needle.includes(entry.entry_name));
    })
    .map(entry => entry.summary || entry.match_reason || entry.role_in_story)
    .filter(Boolean);
}

function supplementEntries(story: StoryGenerateResult): string[] {
  return (story.supplement_tasks ?? [])
    .filter(task => task.status === 'resolved' && task.supplement_note?.trim())
    .map(task => [
      task.label,
      task.category,
      task.supplement_note,
      ...(task.recommended_fields ?? []),
    ].filter(Boolean).join(' '));
}

function findSupplementSnippets(story: StoryGenerateResult, needles: Array<string | undefined>): string[] {
  const normalizedNeedles = needles
    .map(needle => needle?.trim())
    .filter((needle): needle is string => Boolean(needle));
  const entries = supplementEntries(story);
  if (entries.length === 0) return [];
  if (normalizedNeedles.length === 0) return entries;

  return entries.filter(entry =>
    normalizedNeedles.some(needle => entry.includes(needle) || needle.includes(entry)),
  );
}

function detailSentence(subject: string, text: string, maxParts = 3): string | undefined {
  const parts = uniqueShortParts(
    text
      .split(/(?<=[。！？!?；;])/)
      .map(part => part.trim())
      .filter(part => part.includes(subject) || part.length >= 8),
    maxParts,
  );
  return parts.length > 0 ? parts.join('；') : undefined;
}

function normalizeAssetName(name: string): string {
  return stripMarkdown(name).trim().replace(/\s+/g, ' ').substring(0, 200);
}

function stripMarkdown(value: string): string {
  return value
    .replace(/\*\*/g, '')
    .replace(/[“”"]/g, '')
    .replace(/^[#>\-\s]+/g, '')
    .trim();
}

function normalizeCharacterName(name: string): string {
  return normalizeAssetName(name)
    .replace(/^[*#>\-\s]+/g, '')
    .replace(/[：:].*$/g, '')
    .replace(/（.*?）/g, '')
    .replace(/(.{2,12})(少年|青年|学生|老师|父亲|母亲|叔叔|阿姨|老奶奶|老爷爷|村民|众人|人群)$/g, '$1')
    .replace(/[，,。！？!?；;：:].*$/g, '')
    .substring(0, 40)
    .trim();
}

function isLikelyNonCharacterName(name: string, story: StoryGenerateResult): boolean {
  const explicitNames = new Set((story.characters ?? []).map(character => normalizeCharacterName(character.name)));
  if (explicitNames.has(name)) return false;
  if (name.length < 2 || name.length > 8) return true;
  if (/^(韶山|湘潭|长沙|东山|北京|延安|井冈山|天安门|长沙新式学校)/.test(name)) return true;
  if (/(评论|运动|会议|路线|纲领|事件|行动|计划|政策|学校|地点|场景|章节|开场|高潮|尾声|身份介绍|关键时刻)/.test(name)) return true;
  const blockedWords = [
    '传说',
    '故事',
    '事件',
    '悟道',
    '天然',
    '溶洞',
    '月岩',
    '道县',
    '永州',
    '书院',
    '军衙',
    '出身',
    '少年时',
    '身份',
    '选择',
    '局面',
    '韶山少年',
    '韶山',
    '湘潭',
    '长沙',
    '东山',
  ];
  return blockedWords.some(word => name.includes(word));
}

function normalizeSceneName(name: string, scene: StoryScene): string {
  const text = stripMarkdown(`${name} ${scene.title ?? ''} ${scene.plot ?? ''} ${scene.visual_prompt ?? ''}`);
  if (text.includes('月岩') || text.includes('天然溶洞') || text.includes('溶洞')) return '月岩洞';
  if (text.includes('濂溪')) return '濂溪畔';
  if (text.includes('南安军衙')) return '南安军衙';
  const colonMatch = stripMarkdown(name).match(/^[^：:]{2,24}[：:](.+)$/);
  if (colonMatch?.[1]?.trim()) return normalizeAssetName(colonMatch[1].trim()).substring(0, 80);
  const withoutPrefix = stripMarkdown(name)
    .replace(/^[^：:]{2,24}[：:]/, '')
    .replace(/^(道县有著名|著名|天然)/, '')
    .replace(/["“”]/g, '')
    .trim();
  const cleaned = withoutPrefix || scene.title || `场景${scene.scene_id}`;
  return normalizeAssetName(cleaned).substring(0, 80);
}

function filterSceneDescriptionParts(sceneName: string, parts: string[]): string[] {
  const cleanedParts = parts
    .map(part => sanitizeSceneDescriptionPart(removePersonalHistoryFromScenePart(part)))
    .filter(Boolean);
  if (sceneName !== '月岩洞') return cleanedParts;
  const unrelatedCaseWords = ['上官', '催签', '签字', '拒签', '案卷', '卷宗', '文书', '判词', '疑案', '军衙'];
  return cleanedParts.filter(part => !unrelatedCaseWords.some(word => part.includes(word)));
}

function removePersonalHistoryFromScenePart(part: string): string {
  const clauses = part
    .split(/(?<=[，,。；;])/)
    .map(clause => clause.trim())
    .filter(Boolean);
  const blockedWords = ['幼年丧父', '母亲', '抚养', '主人公经历', '关键选择', '人生', '身份'];
  const kept = clauses.filter(clause => !blockedWords.some(word => clause.includes(word)));
  return kept.join('').trim();
}

function sanitizeSceneDescriptionPart(part: string): string {
  return stripMarkdown(part)
    .replace(/[“”"]/g, '')
    .replace(/^[^：:]{2,24}[：:]/, '')
    .split(/(?<=[。！？!?；;])/)
    .map(clause => clause.trim())
    .filter(Boolean)
    .filter(clause => !isSceneDescriptionPollution(clause))
    .join('')
    .trim();
}

function isSceneDescriptionPollution(text: string): boolean {
  return [
    '核心画面是',
    '关键时刻',
    '做出选择',
    '故事',
    '什么身份',
    '为什么必须',
    '流派',
    '质量信号',
    '建议调整',
    '匹配度',
    '资料',
    '摘要',
    '韶山少年',
    '湘江评论与驱张运动',
    '什么身份',
  ].some(word => text.includes(word));
}

function buildSceneDescription(sceneName: string, parts: string[]): string {
  if (sceneName === '月岩洞') {
    const extraParts = uniqueShortParts(parts.filter(part => ['洞', '岩', '道县', '读书', '月'].some(word => part.includes(word))), 2);
    return uniqueShortParts([
      '道县月岩洞一带的天然岩洞空间，洞口、岩壁与石质地面是场景主体',
      ...extraParts,
    ], 3).join('；');
  }
  return uniqueShortParts(parts, 4).join('；');
}

function inferEnvironmentProps(sceneName: string, text: string): string | undefined {
  if (sceneName === '月岩洞') return '洞口、岩壁、石质地面';
  const candidates = [
    '油灯',
    '烛火',
    '书桌',
    '木案',
    '案卷',
    '卷宗',
    '文书',
    '判词',
    '旧书',
    '毛笔',
    '溪水',
    '石板路',
    '书架',
    '香炉',
    '碑刻',
  ];
  const matched = candidates.filter(item => text.includes(item));
  return matched.length > 0 ? [...new Set(matched)].slice(0, 5).join('、') : undefined;
}

function uniqueShortParts(parts: string[], maxParts = 3): string[] {
  const result: string[] = [];
  for (const part of parts) {
    const cleaned = part.trim().replace(/\s+/g, ' ');
    if (!cleaned || result.includes(cleaned)) continue;
    result.push(cleaned.length > 90 ? `${cleaned.substring(0, 90)}…` : cleaned);
    if (result.length >= maxParts) break;
  }
  return result;
}

function inferSceneType(name: string, text: string): GearsSceneType {
  const combined = `${name} ${text}`;
  if (['洞', '窟', '室内'].some(word => combined.includes(word))) return '室内';
  if (['室内', '房', '厅', '馆', '殿', '堂', '书房', '教室', '会议室', '衙', '阁内'].some(word => combined.includes(word))) return '室内';
  if (['室外', '山', '江', '河', '湖', '街', '路', '村', '田', '广场', '庭院', '城外'].some(word => combined.includes(word))) return '室外';
  return '不限';
}

function inferAtmosphere(scenes: StoryScene[]): GearsSceneAtmosphere {
  const text = scenes.map(scene => `${scene.dramatic_function} ${scene.plot} ${scene.conflict ?? ''}`).join(' ');
  if (['冲突', '对峙', '危机', '紧张', '逼'].some(word => text.includes(word))) return '紧张';
  if (['压抑', '沉重', '困境'].some(word => text.includes(word))) return '压抑';
  if (['温暖', '希望', '明亮'].some(word => text.includes(word))) return '温馨';
  if (['神秘', '传说', '梦'].some(word => text.includes(word))) return '神秘';
  return '中性';
}

function buildDeliveryUnits(
  story: StoryGenerateResult,
  characterAssets: GearsCharacterAsset[],
): GearsDeliveryUnit[] {
  const units: GearsDeliveryUnit[] = [];
  const validCharacterNames = new Set(characterAssets.map(character => character.name));
  for (const scene of story.scene_breakdown) {
    const chunks = splitSceneIntoChunks(scene);
    const sceneSegments = story.gears_segments.filter(
      segment => segment.source_scene_id === scene.scene_id,
    );
    chunks.forEach((chunk, index) => {
      const segment = sceneSegments[index] ?? sceneSegments[0];
      const segmentConstraintNote = segment && 'constraint_note' in segment
        && Array.isArray(segment.constraint_note)
        ? segment.constraint_note.filter((item): item is string => typeof item === 'string')
        : segment?.cultural_constraints ?? [];
      const targetDuration = Math.max(5, Math.min(15, Math.ceil(scene.duration_sec / chunks.length)));
      const unitDuration = chooseSuggestedDuration(targetDuration, chunk);
      units.push({
        unit_id: chunks.length > 1 ? `${scene.scene_id}.${index + 1}` : `${scene.scene_id}`,
        source_scene_id: scene.scene_id,
        scene_name: normalizeSceneName(scene.location || scene.title || `场景${scene.scene_id}`, scene),
        character_names: (scene.characters ?? [])
          .map(name => normalizeCharacterName(name))
          .filter(name => name && validCharacterNames.has(name)),
        suggested_duration_sec: unitDuration,
        suggested_panel_count: choosePanelCount(unitDuration, chunk),
        time_of_day: normalizeTimeOfDay(scene.time_of_day),
        beat_count: estimateBeatCount(chunk),
        script_text: chunk,
        visual_prompt: scene.visual_prompt?.trim() || undefined,
        camera_suggestion: scene.camera_suggestion?.trim() || undefined,
        segment_prompt_hint: segment?.segment_prompt_hint?.trim() || undefined,
        constraint_note: [...new Set([
          ...segmentConstraintNote,
          ...story.cultural_constraints,
        ].map(item => item.trim()).filter(Boolean))],
      });
    });
  }
  return units;
}

function splitSceneIntoChunks(scene: StoryScene): string[] {
  const rawText = buildUnitScriptText(scene);
  const sentenceParts = rawText
    .split(/(?<=[。！？!?])/)
    .map(part => part.trim())
    .filter(Boolean);

  const targetCount = Math.max(1, Math.ceil(scene.duration_sec / 15));
  if (targetCount === 1 || sentenceParts.length <= 1) return [rawText.trim()].filter(Boolean);

  const chunks: string[] = [];
  let current = '';
  const targetLength = Math.ceil(rawText.length / targetCount);
  for (const sentence of sentenceParts) {
    if (current && current.length + sentence.length > targetLength && chunks.length < targetCount - 1) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  const mergedChunks = mergeShortChunks(chunks);
  return mergedChunks.length > 0 ? mergedChunks : [rawText.trim()].filter(Boolean);
}

function mergeShortChunks(chunks: string[], minScriptChars = 18): string[] {
  const merged: string[] = [];
  let current = '';

  for (const chunk of chunks) {
    if (!current) {
      current = chunk;
      continue;
    }
    if (countCjkAndWordChars(current) < minScriptChars || hasOnlyQuestion(current)) {
      current = `${current}\n${chunk}`;
    } else {
      merged.push(current);
      current = chunk;
    }
  }

  if (current) {
    if (merged.length > 0 && (countCjkAndWordChars(current) < minScriptChars || hasOnlyQuestion(current))) {
      merged[merged.length - 1] = `${merged[merged.length - 1]}\n${current}`;
    } else {
      merged.push(current);
    }
  }

  return merged;
}

function buildUnitScriptText(scene: StoryScene): string {
  const parts = compactStrings([
    scene.plot,
    scene.key_action && !scene.plot?.includes(scene.key_action) ? scene.key_action : undefined,
    scene.conflict && !scene.plot?.includes(scene.conflict) ? `冲突：${scene.conflict}` : undefined,
    scene.dialogue_or_narration,
  ]);
  const cleaned = parts
    .map(part => stripMarkdown(part)
      .replace(/^[「『"“”]+$/g, '')
      .replace(/^[」』"“”]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim())
    .filter(part => !isScriptPollution(part))
    .filter(Boolean);
  if (cleaned.length > 0) {
    const text = cleaned.join('\n');
    if (countCjkAndWordChars(text) >= 18 && !hasOnlyQuestion(text)) return text;
    return expandThinScriptText(scene, text);
  }
  return `【文本待补】场景 ${scene.scene_id} 缺少可供 GEARS 分镜使用的剧本正文。`;
}

function isScriptPollution(text: string): boolean {
  const normalized = text.replace(/\s+/g, '');
  if (/^["“”'‘’]+$/.test(normalized)) return true;
  return [
    '什么身份',
    '为什么必须面对',
    '关键时刻到来',
    '核心画面是',
    '质量信号',
    '流派质量',
    '建议调整方向',
  ].some(word => normalized.includes(word));
}

function expandThinScriptText(scene: StoryScene, currentText: string): string {
  const lines = compactStrings([
    currentText && !hasOnlyQuestion(currentText) ? currentText : undefined,
    scene.location ? `画面落在${stripMarkdown(scene.location)}，人物进入当下处境。` : undefined,
    scene.key_action ? `关键动作：${stripMarkdown(scene.key_action)}。` : undefined,
    scene.conflict ? `冲突压力：${stripMarkdown(scene.conflict)}。` : undefined,
    scene.dialogue_or_narration && !isScriptPollution(scene.dialogue_or_narration) ? stripMarkdown(scene.dialogue_or_narration) : undefined,
  ]);
  if (lines.length > 0) return lines.join('\n');
  return `【文本待补】场景 ${scene.scene_id} 缺少可供 GEARS 分镜使用的剧本正文。`;
}

function chooseSuggestedDuration(targetDuration: number, scriptText: string): number {
  const contentLength = countCjkAndWordChars(scriptText);
  if (scriptText.includes('【文本待补】')) return 5;
  if (contentLength < 12) return 5;
  if (contentLength < 24) return Math.min(targetDuration, 8);
  return targetDuration;
}

function choosePanelCount(durationSec: number, scriptText: string): PanelCount {
  const beatCount = estimateBeatCount(scriptText);
  const preferred = durationSec <= 6
    ? 4
    : durationSec <= 9
      ? 6
      : beatCount >= 3
        ? 9
        : 8;
  return VALID_PANEL_COUNTS.includes(preferred as PanelCount) ? preferred as PanelCount : 6;
}

function estimateBeatCount(text: string): number {
  const markers = ['。', '！', '？', '；', '\n'];
  const count = markers.reduce((sum, marker) => sum + text.split(marker).length - 1, 0);
  return Math.max(1, Math.min(3, count || 1));
}

function countCjkAndWordChars(text: string): number {
  return (text.match(/[\p{Script=Han}A-Za-z0-9]/gu) ?? []).length;
}

function hasOnlyQuestion(text: string): boolean {
  const cleaned = text.replace(/\s+/g, '');
  return cleaned.endsWith('？') || cleaned.endsWith('?')
    ? !/[。！!；;\n]/.test(cleaned.replace(/[？?]+$/g, ''))
    : false;
}

function normalizeTimeOfDay(value: string): GearsTimeOfDay | undefined {
  if (['早', '清晨', '上午'].some(word => value.includes(word))) return '早';
  if (['午', '白天', '正午'].some(word => value.includes(word))) return '午';
  if (['夕', '黄昏', '傍晚'].some(word => value.includes(word))) return '夕';
  if (['夜', '晚上', '深夜'].some(word => value.includes(word))) return '夜';
  return undefined;
}

function validateDeliveryPackage(
  characters: GearsCharacterAsset[],
  scenes: GearsSceneAsset[],
  units: GearsDeliveryUnit[],
): string[] {
  const notes: string[] = [];
  const characterNames = new Set(characters.map(character => character.name));
  const sceneNames = new Set(scenes.map(scene => scene.name));

  for (const character of characters) {
    if (character.appearance_features.includes('需按史料或项目设定补充')) {
      notes.push(`人物资产 ${character.name} 缺少稳定外观细节`);
    }
  }

  for (const scene of scenes) {
    if (scene.description.includes('需由供稿侧补充')) {
      notes.push(`场景资产 ${scene.name} 缺少空间结构与陈设细节`);
    }
  }

  for (const unit of units) {
    if (unit.suggested_duration_sec > 15) {
      notes.push(`单元 ${unit.unit_id} 超过 15 秒`);
    }
    if (!sceneNames.has(unit.scene_name)) {
      notes.push(`单元 ${unit.unit_id} 的场景名未命中资产清单：${unit.scene_name}`);
    }
    for (const name of unit.character_names) {
      if (!characterNames.has(name)) {
        notes.push(`单元 ${unit.unit_id} 的人物名未命中资产清单：${name}`);
      }
    }
    const scriptLength = countCjkAndWordChars(unit.script_text);
    if (unit.script_text.includes('【文本待补】')) {
      notes.push(`单元 ${unit.unit_id} 缺少可供分镜使用的剧本正文`);
    } else if (scriptLength < 18) {
      notes.push(`单元 ${unit.unit_id} 正文过短，不足以支撑 ${unit.suggested_duration_sec} 秒分镜`);
    } else if (hasOnlyQuestion(unit.script_text)) {
      notes.push(`单元 ${unit.unit_id} 只有问题句，建议补充动作、反应或台词`);
    }
  }

  return notes;
}

function validateProductionMaterialReadiness(
  report: StoryGenerateResult['production_material_readiness'],
): string[] {
  if (!report) return [];
  const productionGate = report.gate_reports.find(gate => gate.stage === 'production_ready');
  if (report.status === 'ready' && report.score >= 70 && (!productionGate || productionGate.status === 'ready')) {
    return [];
  }

  const productionMissingFields = report.missing_fields.filter(field => field.stage === 'production_ready');
  const visibleMissingFields = (productionMissingFields.length > 0 ? productionMissingFields : report.missing_fields)
    .filter((field, index, arr) => arr.findIndex(item => item.field_id === field.field_id) === index)
    .slice(0, 6);

  return [
    `生产素材未达 production_ready：${report.pack_label} ${report.status}，${report.score}/100`,
    ...visibleMissingFields.map(field =>
      `生产素材缺口 ${field.label}（${field.stage}/${field.blocking_level}）：${field.reason}`,
    ),
    ...report.recommended_next_questions.slice(0, 3).map(question => `生产素材补充问题：${question}`),
  ];
}

function deriveDeliveryStatus(validationNotes: string[]): GearsDeliveryStatus {
  return validationNotes.length > 0 ? 'needs_input' : 'ready';
}

function renderDeliveryMarkdown(pkg: Omit<GearsDeliveryPackage, 'markdown'>): string {
  const lines: string[] = [
    `# ${pkg.title} — GEARS 供稿包`,
    '',
    `> schema: ${pkg.schema_version}`,
    `> storyId: ${pkg.storyId}`,
    `> sourceDomain: ${pkg.sourceDomain}`,
    `> delivery_status: ${pkg.delivery_status ?? deriveDeliveryStatus(pkg.validation_notes)}`,
    '',
    '# 人物性别统计',
    '',
    `- 总人物资产: ${pkg.character_gender_summary.total}`,
    `- 男: ${pkg.character_gender_summary.male}`,
    `- 女: ${pkg.character_gender_summary.female}`,
    `- 其他: ${pkg.character_gender_summary.other}`,
    `- 未指定: ${pkg.character_gender_summary.unspecified}`,
    `- 不适用: ${pkg.character_gender_summary.not_applicable}`,
    '',
    '# 资产清单',
    '',
    '## 人物',
  ];

  for (const character of pkg.character_assets) {
    lines.push(
      '',
      `### ${character.name}`,
      `- 角色定位: ${character.role_position}`,
      `- 物种类型: ${character.species_type}`,
      `- 族裔: ${character.ethnicity.join('、')}`,
      `- 性别: ${character.gender}`,
      `- 年龄段: ${character.age_range}`,
      `- 外观特征: ${character.appearance_features}`,
      `- 服装: ${character.clothing}`,
    );
    if (character.carried_props || character.signature_objects) {
      lines.push(`- 随身/标志性物件: ${character.carried_props ?? character.signature_objects}`);
    }
    if (character.background_oneliner) lines.push(`- 一句话背景: ${character.background_oneliner}`);
  }

  lines.push('', '## 场景');
  for (const scene of pkg.scene_assets) {
    lines.push(
      '',
      `### ${scene.name}`,
      `- 场景类型: ${scene.scene_type}`,
      `- 场景描述: ${scene.description}`,
      ...(scene.environment_props ? [`- 场景道具/陈设: ${scene.environment_props}`] : []),
      `- 氛围: ${scene.atmosphere}`,
    );
  }

  lines.push('', '---', '', '# 剧本单元');
  for (const unit of pkg.units) {
    lines.push(
      '',
      `## 单元 ${unit.unit_id}`,
      `- 场景: ${unit.scene_name}`,
      `- 出场人物: ${unit.character_names.join('、') || '无'}`,
      `- 建议时长: ${unit.suggested_duration_sec} 秒`,
      `- 建议格数: ${unit.suggested_panel_count}`,
    );
    if (unit.time_of_day) lines.push(`- 时段: ${unit.time_of_day}`);
    if (unit.visual_prompt) lines.push(`- 视觉提示: ${unit.visual_prompt}`);
    if (unit.camera_suggestion) lines.push(`- 运镜建议: ${unit.camera_suggestion}`);
    if (unit.segment_prompt_hint) lines.push(`- 段落生成提示: ${unit.segment_prompt_hint}`);
    if (unit.constraint_note?.length) lines.push(`- 约束: ${unit.constraint_note.join('；')}`);
    lines.push('', '正文：', unit.script_text);
  }

  if (pkg.validation_notes.length > 0) {
    lines.push('', '---', '', '# 校验提示', ...pkg.validation_notes.map(note => `- ${note}`));
  }

  return `${lines.join('\n')}\n`;
}
