import type {
  GearsAgeRange,
  GearsCharacterAsset,
  GearsCharacterRolePosition,
  GearsDeliveryPackage,
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

const VALID_PANEL_COUNTS: PanelCount[] = [4, 6, 8, 9, 10, 12];

export function buildGearsDeliveryPackage(story: StoryGenerateResult): GearsDeliveryPackage {
  const characterAssets = buildCharacterAssets(story);
  const sceneAssets = buildSceneAssets(story);
  const units = buildDeliveryUnits(story.scene_breakdown, characterAssets);
  const validationNotes = validateDeliveryPackage(characterAssets, sceneAssets, units);
  const pkgWithoutMarkdown = {
    schema_version: 'gears-delivery/v1',
    storyId: story.storyId,
    title: story.title,
    character_assets: characterAssets,
    scene_assets: sceneAssets,
    units,
    validation_notes: validationNotes,
  };

  return {
    ...pkgWithoutMarkdown,
    markdown: renderDeliveryMarkdown(pkgWithoutMarkdown),
  };
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
  const characterContext = [
    character?.description,
    character?.arc,
    ...findKnowledgeSnippets(story, [name, story.source_entry]),
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
    gender: '未指定',
    age_range: inferAgeRange(`${name} ${characterContext} ${storyContext}`),
    appearance_features: appearanceFeatures,
    clothing: inferClothing(`${characterContext} ${storyContext}`),
    ...(carriedProps ? { carried_props: carriedProps, signature_objects: carriedProps } : {}),
    ...(character?.arc
      ? { background_oneliner: character.arc }
      : detailSentence(name, characterContext, 1)
        ? { background_oneliner: detailSentence(name, characterContext, 1) }
        : {}),
  };
}

function mapRolePosition(role: string | undefined, index: number): GearsCharacterRolePosition {
  const normalized = role ?? '';
  if (index === 0 || ['主角', 'protagonist', 'main'].some(key => normalized.includes(key))) return '主角';
  if (['反派', 'antagonist', 'opponent'].some(key => normalized.includes(key))) return '反派';
  if (['群演', 'crowd'].some(key => normalized.includes(key))) return '群演';
  if (['路人', 'passerby'].some(key => normalized.includes(key))) return '路人';
  return '配角';
}

function inferAgeRange(text: string): GearsAgeRange {
  if (text.includes('儿童') || text.includes('孩子')) return '儿童';
  if (text.includes('少年')) return '少年';
  if (text.includes('青年') || text.includes('求学')) return '青年';
  if (text.includes('中年')) return '中年';
  if (text.includes('老年') || text.includes('晚年')) return '老年';
  return '青年';
}

function inferClothing(text: string): string {
  if (['周敦颐', '濂溪', '理学', '太极图说', '爱莲说', '宋', '北宋'].some(word => text.includes(word))) {
    return '北宋士人或少年读书人固定服装：素色交领长衫或圆领袍，布履，头发束起，所有单元保持一致。';
  }
  if (text.includes('革命') || text.includes('近代') || text.includes('民国')) {
    return '符合近现代中国历史语境的朴素固定服装，可采用学生装、长衫或早期革命者常服，所有单元保持一致。';
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
    .replace(/[，,。！？!?；;：:].*$/g, '')
    .substring(0, 40)
    .trim();
}

function isLikelyNonCharacterName(name: string, story: StoryGenerateResult): boolean {
  const explicitNames = new Set((story.characters ?? []).map(character => normalizeCharacterName(character.name)));
  if (explicitNames.has(name)) return false;
  if (name.length < 2 || name.length > 8) return true;
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
  ];
  return blockedWords.some(word => name.includes(word));
}

function normalizeSceneName(name: string, scene: StoryScene): string {
  const text = stripMarkdown(`${name} ${scene.title ?? ''} ${scene.plot ?? ''} ${scene.visual_prompt ?? ''}`);
  if (text.includes('月岩') || text.includes('天然溶洞') || text.includes('溶洞')) return '月岩洞';
  if (text.includes('濂溪')) return '濂溪畔';
  if (text.includes('南安军衙')) return '南安军衙';
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
    .map(removePersonalHistoryFromScenePart)
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

function buildDeliveryUnits(scenes: StoryScene[], characterAssets: GearsCharacterAsset[]): GearsDeliveryUnit[] {
  const units: GearsDeliveryUnit[] = [];
  const validCharacterNames = new Set(characterAssets.map(character => character.name));
  for (const scene of scenes) {
    const chunks = splitSceneIntoChunks(scene);
    chunks.forEach((chunk, index) => {
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
  return chunks.length > 0 ? chunks : [rawText.trim()].filter(Boolean);
}

function buildUnitScriptText(scene: StoryScene): string {
  const parts = compactStrings([
    scene.plot,
    scene.key_action && !scene.plot?.includes(scene.key_action) ? scene.key_action : undefined,
    scene.dialogue_or_narration,
  ]);
  const cleaned = parts
    .map(part => stripMarkdown(part)
      .replace(/^[「『"“”]+$/g, '')
      .replace(/^[」』"“”]+$/g, '')
      .trim())
    .filter(Boolean);
  if (cleaned.length > 0) return cleaned.join('\n');
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

function renderDeliveryMarkdown(pkg: Omit<GearsDeliveryPackage, 'markdown'>): string {
  const lines: string[] = [
    `# ${pkg.title} — GEARS 供稿包`,
    '',
    `> schema: ${pkg.schema_version}`,
    `> storyId: ${pkg.storyId}`,
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
    lines.push('', '正文：', unit.script_text);
  }

  if (pkg.validation_notes.length > 0) {
    lines.push('', '---', '', '# 校验提示', ...pkg.validation_notes.map(note => `- ${note}`));
  }

  return `${lines.join('\n')}\n`;
}
