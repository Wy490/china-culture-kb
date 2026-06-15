import type {
  GearsDeliveryPackage,
  GearsSegment,
  StoryGenerateResult,
  StoryProductionBoard,
  StoryProductionBoardDirectorPlan,
  StoryProductionBoardPropAsset,
  StoryProductionBoardQaReport,
  StoryProductionBoardRepairAction,
  StoryProductionBoardRepairPlan,
  StoryProductionBoardRepairPriority,
  StoryProductionBoardRepairTask,
  StoryProductionBoardShotUnit,
  StoryProductionBoardSupervisionIssue,
  StoryProductionBoardSupervisionReport,
} from '@shared/types.js';
import { ensureGearsDeliveryPackage } from './gears-delivery-service.js';

const DEFAULT_NEGATIVE_CONSTRAINTS = [
  '不要把来源、质量报告、内部分析或 TODO 写入画面提示',
  '不要混用明显错误朝代服饰、现代物件或不可见抽象概念',
  '不要让同一角色在相邻镜头中服装、年龄、发型突变',
];

export function buildStoryProductionBoard(story: StoryGenerateResult): StoryProductionBoard {
  const delivery = ensureGearsDeliveryPackage(story);
  const shotUnits = buildShotUnits(story, delivery);
  const directorPlan = buildDirectorPlan(story);
  const propAssets = buildPropAssets(story);
  const costumeAssets = delivery.character_assets.map((asset, index) => ({
    asset_id: `costume-${index + 1}`,
    character_name: asset.name,
    clothing: asset.clothing,
    continuity_note: `${asset.name}在所有镜头中保持服装、发型、随身物件一致；如有年龄或状态变化，需要在分镜说明中显式交代。`,
  }));
  const continuityConstraints = buildContinuityConstraints(story, delivery);
  const supervisionReport = buildSupervisionReport(story, delivery, shotUnits);
  const repairPlan = buildRepairPlan(supervisionReport);
  const qaReport = buildQaReport(shotUnits, delivery.validation_notes, supervisionReport);
  const pkgWithoutMarkdown: Omit<StoryProductionBoard, 'markdown'> = {
    schema_version: 'story-production-board/v1',
    project_id: story.project_id,
    storyId: story.storyId,
    title: story.title,
    generated_at: new Date().toISOString(),
    character_assets: delivery.character_assets,
    location_assets: delivery.scene_assets,
    costume_assets: costumeAssets,
    prop_assets: propAssets,
    director_plan: directorPlan,
    shot_units: shotUnits,
    continuity_constraints: continuityConstraints,
    negative_constraints: DEFAULT_NEGATIVE_CONSTRAINTS,
    supervision_report: supervisionReport,
    repair_plan: repairPlan,
    qa_report: qaReport,
  };
  return {
    ...pkgWithoutMarkdown,
    markdown: renderProductionBoardMarkdown(pkgWithoutMarkdown),
  };
}

function buildShotUnits(
  story: StoryGenerateResult,
  delivery: GearsDeliveryPackage,
): StoryProductionBoardShotUnit[] {
  return story.scene_breakdown.map(scene => {
    const segment = story.gears_segments.find(item => item.source_scene_id === scene.scene_id);
    const unit = delivery.units.find(item => item.source_scene_id === scene.scene_id);
    const scriptText = segment?.script_text || scene.dialogue_or_narration || scene.key_action || scene.plot;
    const visualPrompt = cleanPrompt(scene.visual_prompt);
    const cameraSuggestion = cleanPrompt(scene.camera_suggestion);
    const continuityNotes = [
      scene.cultural_note,
      scene.factual_basis,
      ...(scene.fictionalized_elements?.map(item => `戏剧化补足：${item}`) ?? []),
      ...(segment?.cultural_constraints ?? []),
    ].filter((note): note is string => Boolean(note));
    const qaFlags = shotQaFlags({
      scriptText,
      visualPrompt,
      cameraSuggestion,
      characters: scene.characters ?? [],
      location: scene.location,
      segment,
    });
    return {
      shot_id: `shot-${scene.scene_id}`,
      source_scene_id: scene.scene_id,
      source_segment_id: segment?.segment_id,
      duration_sec: segment?.duration_sec ?? scene.duration_sec,
      panel_count: segment?.panel_count ?? unit?.suggested_panel_count ?? 6,
      characters: scene.characters ?? [],
      location: scene.location,
      script_text: scriptText,
      visual_prompt: visualPrompt,
      camera_suggestion: cameraSuggestion,
      production_prompt: buildProductionPrompt({
        location: scene.location,
        characters: scene.characters ?? [],
        visualPrompt,
        cameraSuggestion,
        segmentPromptHint: segment?.segment_prompt_hint,
      }),
      continuity_notes: continuityNotes,
      cultural_boundary: scene.factual_basis
        ? `事实依据：${scene.factual_basis}`
        : scene.cultural_note || '按知识库可信边界处理，戏剧化补足不可写成确证史实。',
      negative_constraints: DEFAULT_NEGATIVE_CONSTRAINTS,
      qa_flags: qaFlags,
    };
  });
}

function buildDirectorPlan(story: StoryGenerateResult): StoryProductionBoardDirectorPlan[] {
  return story.scene_breakdown.map((scene, index) => ({
    scene_id: scene.scene_id,
    dramatic_purpose: scene.dramatic_function || scene.conflict || '推进本场戏剧目标',
    emotion_turn: scene.conflict
      ? `${scene.conflict} -> ${scene.key_action}`
      : scene.key_action,
    camera_logic: scene.camera_suggestion || '用稳定镜头建立空间，再以中近景承接人物动作。',
    transition_hint: index === story.scene_breakdown.length - 1
      ? '收束到主题余味或下一集钩子。'
      : `承接到场景 ${story.scene_breakdown[index + 1]?.scene_id}：${story.scene_breakdown[index + 1]?.title}`,
  }));
}

function buildPropAssets(story: StoryGenerateResult): StoryProductionBoardPropAsset[] {
  const propMap = new Map<string, Set<number>>();
  const candidates = ['案卷', '文书', '判词', '毛笔', '书信', '旧信', '印章', '石碑', '莲', '灯', '伞', '铜铃', '香炉'];
  for (const scene of story.scene_breakdown) {
    const text = [
      scene.title,
      scene.plot,
      scene.key_action,
      scene.visual_prompt,
      scene.dialogue_or_narration,
    ].join(' ');
    for (const prop of candidates) {
      if (!text.includes(prop)) continue;
      if (!propMap.has(prop)) propMap.set(prop, new Set());
      propMap.get(prop)?.add(scene.scene_id);
    }
  }
  return [...propMap.entries()].map(([label, sceneIds], index) => ({
    asset_id: `prop-${index + 1}`,
    label,
    source_scene_ids: [...sceneIds].sort((a, b) => a - b),
    usage_note: `${label}需要在相关镜头中保持外观一致，并作为动作或线索服务剧情。`,
  }));
}

function buildContinuityConstraints(
  story: StoryGenerateResult,
  delivery: GearsDeliveryPackage,
): string[] {
  return [
    ...delivery.character_assets.map(asset => `${asset.name}: ${asset.appearance_features}；服装：${asset.clothing}`),
    ...delivery.scene_assets.map(asset => `${asset.name}: ${asset.description}`),
    ...(story.cultural_constraints ?? []),
  ].filter(Boolean);
}

function buildQaReport(
  shotUnits: StoryProductionBoardShotUnit[],
  validationNotes: string[],
  supervisionReport: StoryProductionBoardSupervisionReport,
): StoryProductionBoardQaReport {
  const missingAssetRefs = shotUnits
    .filter(unit => unit.characters.length === 0 || !unit.location)
    .map(unit => unit.shot_id);
  const promptPollutionFlags = shotUnits.flatMap(unit =>
    unit.qa_flags
      .filter(flag => flag.includes('提示词杂质'))
      .map(flag => `${unit.shot_id}: ${flag}`),
  );
  const continuityRisks = shotUnits.flatMap(unit =>
    unit.qa_flags
      .filter(flag => flag.includes('连续性'))
      .map(flag => `${unit.shot_id}: ${flag}`),
  );
  const issues = [
    ...validationNotes,
    ...shotUnits.flatMap(unit => unit.qa_flags.map(flag => `${unit.shot_id}: ${flag}`)),
    ...supervisionReport.issues.map(issue => `${issue.source_shot_id ?? 'board'}: ${issue.title} - ${issue.detail}`),
  ];
  const score = Math.min(
    supervisionReport.score,
    Math.max(0, 100 - issues.length * 8 - missingAssetRefs.length * 10),
  );
  return {
    passed: score >= 75 && missingAssetRefs.length === 0 && supervisionReport.passed,
    score,
    issues,
    missing_asset_refs: missingAssetRefs,
    prompt_pollution_flags: promptPollutionFlags,
    continuity_risks: continuityRisks,
  };
}

function shotQaFlags(input: {
  scriptText: string;
  visualPrompt: string;
  cameraSuggestion: string;
  characters: string[];
  location: string;
  segment?: GearsSegment;
}): string[] {
  const flags: string[] = [];
  if (!input.scriptText.trim()) flags.push('缺少 script_text');
  if (!input.visualPrompt.trim()) flags.push('缺少 visual_prompt');
  if (!input.cameraSuggestion.trim()) flags.push('缺少 camera_suggestion');
  if (input.characters.length === 0) flags.push('缺少角色资产引用');
  if (!input.location.trim()) flags.push('缺少场景资产引用');
  if (/(质量|分析|应该|注意|来源显示|TODO|待补)/.test(input.visualPrompt)) {
    flags.push('提示词杂质：visual_prompt 含内部说明或待补信息');
  }
  if (!input.segment?.segment_prompt_hint) flags.push('连续性风险：缺少 segment_prompt_hint');
  return flags;
}

function buildSupervisionReport(
  story: StoryGenerateResult,
  delivery: GearsDeliveryPackage,
  shotUnits: StoryProductionBoardShotUnit[],
): StoryProductionBoardSupervisionReport {
  const issues: StoryProductionBoardSupervisionIssue[] = [];
  const knownCharacters = new Set(delivery.character_assets.map(asset => asset.name));
  const knownLocations = new Set(delivery.scene_assets.map(asset => asset.name));
  const expectedPeriod = inferExpectedPeriod(story);

  for (const unit of shotUnits) {
    if (unit.characters.length === 0) {
      issues.push(supervisionIssue({
        category: 'asset',
        severity: 'blocker',
        unit,
        title: '缺少角色资产',
        detail: '镜头没有绑定角色，后续分镜和视频生成无法稳定复用人物形象。',
        fix_hint: '为该镜头补入至少一个角色，并在角色资产表中声明服饰、年龄段和随身物件。',
      }));
    }

    for (const character of unit.characters) {
      if (knownCharacters.has(character)) continue;
      issues.push(supervisionIssue({
        category: 'asset',
        severity: 'warn',
        unit,
        title: `角色资产未声明：${character}`,
        detail: '镜头引用了角色名，但角色资产表中没有对应形象设定。',
        fix_hint: '把该角色加入 character_assets，或把镜头角色名统一到已有资产名。',
      }));
    }

    if (!unit.location.trim()) {
      issues.push(supervisionIssue({
        category: 'asset',
        severity: 'blocker',
        unit,
        title: '缺少场景资产',
        detail: '镜头没有场景空间，画面生成会失去构图和环境锚点。',
        fix_hint: '补入具体地点，并在 location_assets 中声明空间类型、陈设和氛围。',
      }));
    } else if (!knownLocations.has(unit.location)) {
      issues.push(supervisionIssue({
        category: 'asset',
        severity: 'warn',
        unit,
        title: `场景资产未声明：${unit.location}`,
        detail: '镜头地点没有进入场景资产表，跨镜头复用时容易漂移。',
        fix_hint: '把该地点加入 location_assets，或把镜头地点归并到已有场景资产。',
      }));
    }

    if (hasPromptPollution(unit.visual_prompt) || hasPromptPollution(unit.production_prompt)) {
      issues.push(supervisionIssue({
        category: 'prompt',
        severity: 'warn',
        unit,
        title: '提示词含内部说明',
        detail: '画面或生产提示中混入质量、分析、来源、TODO 等不可见信息。',
        fix_hint: '只保留可见的人物、空间、道具、光线、构图、动作和情绪表现。',
      }));
    }

    if (!isFilmable(unit)) {
      issues.push(supervisionIssue({
        category: 'filmability',
        severity: 'warn',
        unit,
        title: '镜头可拍性不足',
        detail: '镜头缺少可见动作、主体、空间或镜头语言，容易变成抽象说明。',
        fix_hint: '补一个可见动作或道具变化，并明确镜头景别、运动或构图重点。',
      }));
    }

    if (!unit.continuity_notes.length || unit.qa_flags.some(flag => flag.includes('连续性'))) {
      issues.push(supervisionIssue({
        category: 'continuity',
        severity: 'warn',
        unit,
        title: '连续性约束不足',
        detail: '镜头缺少可复用的前后镜头连续性提示。',
        fix_hint: '补充角色状态、服饰、道具位置、线索开合或上一镜头承接关系。',
      }));
    }

    if (unit.duration_sec > 15 && !/(0[-—~至到]\d+秒|\d+[-—~至到]\d+秒)/.test(unit.production_prompt)) {
      issues.push(supervisionIssue({
        category: 'duration',
        severity: 'info',
        unit,
        title: '长镜头缺少时间段拆分',
        detail: '超过 15 秒的镜头如果直接送视频模型，动作节奏可能不稳定。',
        fix_hint: '把生产提示拆成 0-4 秒、4-9 秒、9-15 秒等明确时间段。',
      }));
    }
  }

  if (expectedPeriod) {
    for (const asset of delivery.character_assets) {
      if (!isPeriodMismatch(expectedPeriod, asset.clothing)) continue;
      issues.push({
        issue_id: `period-${issues.length + 1}`,
        category: 'period',
        severity: 'blocker',
        title: `服饰时代错配：${asset.name}`,
        detail: `故事时代倾向为${expectedPeriod}，但角色服饰写成「${asset.clothing}」。`,
        fix_hint: `把 ${asset.name} 的服饰改为符合${expectedPeriod}语境的可见服饰，并同步镜头提示。`,
      });
    }
  }

  const sortedIssues = issues.sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  const blockers = sortedIssues.filter(issue => issue.severity === 'blocker').length;
  const warnings = sortedIssues.filter(issue => issue.severity === 'warn').length;
  const infoCount = sortedIssues.filter(issue => issue.severity === 'info').length;
  const score = Math.max(0, 100 - blockers * 18 - warnings * 8 - infoCount * 3);
  return {
    passed: blockers === 0 && score >= 75,
    score,
    blockers,
    warnings,
    issue_count: sortedIssues.length,
    issues: sortedIssues,
    priority_fixes: uniqueStrings(sortedIssues
      .filter(issue => issue.severity !== 'info')
      .map(issue => `${issue.title}：${issue.fix_hint}`))
      .slice(0, 5),
  };
}

function severityRank(severity: StoryProductionBoardSupervisionIssue['severity']): number {
  if (severity === 'blocker') return 0;
  if (severity === 'warn') return 1;
  return 2;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function buildRepairPlan(report: StoryProductionBoardSupervisionReport): StoryProductionBoardRepairPlan {
  const tasks = [
    buildTaskForAction(report.issues, 'normalize_period_costumes'),
    buildTaskForAction(report.issues, 'register_asset'),
    buildTaskForAction(report.issues, 'clean_prompt'),
    buildTaskForAction(report.issues, 'strengthen_filmability'),
    buildTaskForAction(report.issues, 'add_continuity'),
    buildTaskForAction(report.issues, 'split_duration'),
  ].filter((task): task is StoryProductionBoardRepairTask => Boolean(task));
  return {
    task_count: tasks.length,
    blocker_task_count: tasks.filter(task => task.priority === 'P0').length,
    tasks,
  };
}

function buildTaskForAction(
  issues: StoryProductionBoardSupervisionIssue[],
  action: StoryProductionBoardRepairAction,
): StoryProductionBoardRepairTask | null {
  const targets = issues.filter(issue => repairActionMatchesIssue(action, issue));
  if (!targets.length) return null;
  const targetShotIds = uniqueStrings(targets.map(issue => issue.source_shot_id).filter((id): id is string => Boolean(id)));
  const targetSceneIds = [...new Set(targets.map(issue => issue.source_scene_id).filter((id): id is number => typeof id === 'number'))]
    .sort((a, b) => a - b);
  const priority: StoryProductionBoardRepairPriority = targets.some(issue => issue.severity === 'blocker')
    ? 'P0'
    : targets.some(issue => issue.severity === 'warn') ? 'P1' : 'P2';
  const spec = repairActionSpec(action, targetShotIds, targetSceneIds);
  return {
    task_id: `repair-${action}`,
    action,
    priority,
    target_issue_ids: targets.map(issue => issue.issue_id),
    target_shot_ids: targetShotIds,
    target_scene_ids: targetSceneIds,
    ...spec,
  };
}

function repairActionMatchesIssue(
  action: StoryProductionBoardRepairAction,
  issue: StoryProductionBoardSupervisionIssue,
): boolean {
  if (action === 'normalize_period_costumes') return issue.category === 'period';
  if (action === 'register_asset') return issue.category === 'asset';
  if (action === 'clean_prompt') return issue.category === 'prompt';
  if (action === 'strengthen_filmability') return issue.category === 'filmability';
  if (action === 'add_continuity') return issue.category === 'continuity';
  return issue.category === 'duration';
}

function repairActionSpec(
  action: StoryProductionBoardRepairAction,
  targetShotIds: string[],
  targetSceneIds: number[],
): Pick<StoryProductionBoardRepairTask, 'title' | 'instruction' | 'expected_output' | 'acceptance_criteria'> {
  const shotText = targetShotIds.length ? `目标镜头：${targetShotIds.join('、')}。` : '';
  const sceneText = targetSceneIds.length ? `目标场景：${targetSceneIds.join('、')}。` : '';
  const scope = [shotText, sceneText].filter(Boolean).join('');
  const specs: Record<StoryProductionBoardRepairAction, Pick<StoryProductionBoardRepairTask, 'title' | 'instruction' | 'expected_output' | 'acceptance_criteria'>> = {
    normalize_period_costumes: {
      title: '统一时代服饰资产',
      instruction: `${scope}把角色服饰改成与故事时代一致的可见服装，并同步到角色资产、服饰资产和相关镜头提示；不要使用跨时代词，如清末、民初、五四、现代、西装等。`,
      expected_output: '更新后的 character_assets、costume_assets、production_prompt 与 visual_prompt 服饰描述。',
      acceptance_criteria: ['所有角色服饰与故事时代一致', '镜头提示不再出现跨时代服饰词', '同一角色在全部镜头中服饰稳定'],
    },
    register_asset: {
      title: '补齐角色或场景资产',
      instruction: `${scope}为未声明的角色或地点补齐生产资产，包含名称、类型、外观/空间、服饰或陈设、氛围和复用说明；优先归并到已有资产，避免同物异名。`,
      expected_output: '补齐后的 character_assets 或 location_assets，以及镜头中的统一引用名。',
      acceptance_criteria: ['每个镜头角色都能匹配角色资产', '每个镜头地点都能匹配场景资产', '资产名在镜头和资产表中一致'],
    },
    clean_prompt: {
      title: '清理画面提示词杂质',
      instruction: `${scope}重写 visual_prompt 和 production_prompt，只保留可见的人物、空间、道具、光线、构图、动作、情绪和时代信息；删除质量、分析、来源、待补、生成优先级等内部说明。`,
      expected_output: '可直接给画面或视频模型使用的干净提示词。',
      acceptance_criteria: ['提示词不含内部分析和质量报告词', '提示词具备主体、动作、环境和光线', '保留必要文化边界但不写成来源说明'],
    },
    strengthen_filmability: {
      title: '强化镜头可拍性',
      instruction: `${scope}把抽象剧情说明改成可拍镜头：补主体动作、道具变化、人物表情、空间关系和明确镜头语言。`,
      expected_output: '更具体的 script_text、visual_prompt、camera_suggestion 和 production_prompt。',
      acceptance_criteria: ['每个目标镜头有可见动作', '每个目标镜头有清楚景别或运镜', '画面能被分镜师或视频模型直接理解'],
    },
    add_continuity: {
      title: '补充连续性约束',
      instruction: `${scope}补充角色状态、服饰、道具位置、线索承接、上一镜头/下一镜头关系，写入 continuity_notes 和 segment_prompt_hint。`,
      expected_output: '可复用的 continuity_notes、segment_prompt_hint，以及必要的镜头提示同步。',
      acceptance_criteria: ['角色状态不倒退', '道具和服饰在相邻镜头中稳定', '线索开合关系明确'],
    },
    split_duration: {
      title: '拆分长镜头时间段',
      instruction: `${scope}把超过 15 秒的镜头拆成 0-4 秒、4-9 秒、9-15 秒等时间段，分别标注主体动作、镜头运动、情绪变化和收束画面。`,
      expected_output: '带时间段的 production_prompt，可直接转 Seedance 或同类视频模型提示。',
      acceptance_criteria: ['每段时间都有明确动作', '镜头运动不互相矛盾', '结尾有收束或钩子画面'],
    },
  };
  return specs[action];
}

function supervisionIssue(input: {
  category: StoryProductionBoardSupervisionIssue['category'];
  severity: StoryProductionBoardSupervisionIssue['severity'];
  unit: StoryProductionBoardShotUnit;
  title: string;
  detail: string;
  fix_hint: string;
}): StoryProductionBoardSupervisionIssue {
  return {
    issue_id: `${input.category}-${input.unit.shot_id}`,
    category: input.category,
    severity: input.severity,
    source_shot_id: input.unit.shot_id,
    source_scene_id: input.unit.source_scene_id,
    title: input.title,
    detail: input.detail,
    fix_hint: input.fix_hint,
  };
}

function hasPromptPollution(value: string): boolean {
  return /(质量|分析|应该|注意|来源显示|TODO|待补|知识库缺失|生成优先级|不可写成已验证史实)/.test(value);
}

function isFilmable(unit: StoryProductionBoardShotUnit): boolean {
  const text = [unit.script_text, unit.visual_prompt, unit.camera_suggestion].join(' ');
  const hasVisibleAnchor = /[、，,]/.test(unit.visual_prompt) || /案卷|文书|灯|门|桌|船|山|水|街|院|衙|洞|碑|莲|镜|火|雨|人/.test(unit.visual_prompt);
  const hasAction = /看|走|停|举|落|推|转|打开|拿|递|跪|站|拒|签|追|回头|对峙|凝视|冲/.test(text);
  const hasCamera = /近景|中景|远景|特写|推|拉|摇|移|俯拍|仰拍|对切|定格|镜头/.test(unit.camera_suggestion);
  return hasVisibleAnchor && hasAction && hasCamera;
}

function inferExpectedPeriod(story: StoryGenerateResult): string | null {
  const text = [
    story.source_entry,
    story.full_text,
    story.credibility_note,
    ...story.cultural_constraints,
    ...(story.knowledge_pack?.primary_entries.flatMap(entry => [entry.era ?? '', entry.summary]) ?? []),
    ...(story.knowledge_pack?.supporting_entries.flatMap(entry => [entry.era ?? '', entry.summary]) ?? []),
  ].join(' ');
  if (/周敦颐|濂溪|朱熹|二程|南安军/.test(text)) return '宋';
  if (/岳飞|辛弃疾|陆游|苏轼|王安石|司马光|包拯/.test(text)) return '宋';
  const periods = [
    '先秦', '秦', '汉', '魏晋', '唐', '宋', '元', '明', '清', '民国', '近代', '现代',
  ];
  return periods.find(period => text.includes(period)) ?? null;
}

function isPeriodMismatch(expectedPeriod: string, clothing: string): boolean {
  const normalized = clothing.trim();
  if (!normalized) return true;
  const periodFamilies: Record<string, RegExp> = {
    先秦: /清末|民初|民国|五四|近代|现代|西装|中山装|旗袍/,
    秦: /清末|民初|民国|五四|近代|现代|西装|中山装|旗袍/,
    汉: /清末|民初|民国|五四|近代|现代|西装|中山装|旗袍/,
    魏晋: /清末|民初|民国|五四|近代|现代|西装|中山装|旗袍/,
    唐: /清末|民初|民国|五四|近代|现代|西装|中山装|旗袍/,
    宋: /清末|民初|民国|五四|近代|现代|西装|中山装|旗袍/,
    元: /清末|民初|民国|五四|近代|现代|西装|中山装|旗袍/,
    明: /清末|民初|民国|五四|近代|现代|西装|中山装|旗袍/,
    清: /五四|民初|民国|现代|西装|中山装/,
    民国: /宋制|唐制|汉服|官袍|朝服/,
    近代: /宋制|唐制|汉服|官袍|朝服/,
    现代: /宋制|唐制|官袍|朝服/,
  };
  return periodFamilies[expectedPeriod]?.test(normalized) ?? false;
}

function buildProductionPrompt(input: {
  location: string;
  characters: string[];
  visualPrompt: string;
  cameraSuggestion: string;
  segmentPromptHint?: string;
}): string {
  return [
    `场景：${input.location || '未指定场景'}`,
    `角色：${input.characters.join('、') || '未指定角色'}`,
    `画面：${input.visualPrompt || '按场景动作补足可见画面'}`,
    `镜头：${input.cameraSuggestion || '稳定镜头，动作清楚'}`,
    input.segmentPromptHint ? `生产提示：${input.segmentPromptHint}` : '',
  ].filter(Boolean).join('\n');
}

function cleanPrompt(value: string): string {
  return value
    .replace(/^(视觉提示|画面提示|镜头建议|分析|注意)[:：]\s*/g, '')
    .replace(/来源显示[:：].*/g, '')
    .trim();
}

function renderProductionBoardMarkdown(pkg: Omit<StoryProductionBoard, 'markdown'>): string {
  const lines = [
    `# ${pkg.title} Production Board`,
    '',
    '## 概览',
    `- 故事 ID: ${pkg.storyId}`,
    `- 项目 ID: ${pkg.project_id ?? '未记录'}`,
    `- 生成时间: ${pkg.generated_at}`,
    `- QA: ${pkg.qa_report.passed ? '通过' : '需处理'} · ${pkg.qa_report.score}/100`,
    '',
    '## 角色资产',
    ...pkg.character_assets.map(asset => `- ${asset.name}: ${asset.role_position}；${asset.appearance_features}；服装：${asset.clothing}`),
    '',
    '## 场景资产',
    ...pkg.location_assets.map(asset => `- ${asset.name}: ${asset.scene_type}；${asset.description}；氛围：${asset.atmosphere}`),
    '',
    '## 道具资产',
    ...(pkg.prop_assets.length ? pkg.prop_assets.map(asset => `- ${asset.label}: 场景 ${asset.source_scene_ids.join('、')}；${asset.usage_note}`) : ['- 未自动识别']),
    '',
    '## 导演计划',
    ...pkg.director_plan.map(plan => `- 场景 ${plan.scene_id}: ${plan.dramatic_purpose}；情绪转折：${plan.emotion_turn}；镜头：${plan.camera_logic}；转场：${plan.transition_hint}`),
    '',
    '## 监督检查',
    `- 状态: ${pkg.supervision_report.passed ? '通过' : '需处理'} · ${pkg.supervision_report.score}/100`,
    `- 阻断项: ${pkg.supervision_report.blockers}；警告项: ${pkg.supervision_report.warnings}`,
    ...(pkg.supervision_report.priority_fixes.length
      ? pkg.supervision_report.priority_fixes.map(fix => `- 优先修复: ${fix}`)
      : ['- 优先修复: 无']),
    ...(pkg.supervision_report.issues.length
      ? pkg.supervision_report.issues.map(issue => `- [${issue.severity}/${issue.category}] ${issue.source_shot_id ? `${issue.source_shot_id}: ` : ''}${issue.title}：${issue.detail}；建议：${issue.fix_hint}`)
      : ['- 无监督问题']),
    '',
    '## 生产修复包',
    `- 修复任务: ${pkg.repair_plan.task_count}`,
    `- P0 任务: ${pkg.repair_plan.blocker_task_count}`,
    ...(pkg.repair_plan.tasks.length ? pkg.repair_plan.tasks.map(task => [
      `### ${task.priority} · ${task.title}`,
      `- 动作: ${task.action}`,
      `- 目标镜头: ${task.target_shot_ids.join('、') || '全局'}`,
      `- 指令: ${task.instruction}`,
      `- 期望输出: ${task.expected_output}`,
      `- 验收: ${task.acceptance_criteria.join('；')}`,
      '',
    ]).flat() : ['- 无需修复']),
    '',
    '## 镜头单元',
    ...pkg.shot_units.map(unit => [
      `### ${unit.shot_id}`,
      `- 场景: ${unit.location}`,
      `- 角色: ${unit.characters.join('、') || '未指定'}`,
      `- 时长/格数: ${unit.duration_sec} 秒 / ${unit.panel_count} 格`,
      `- Script: ${unit.script_text}`,
      `- Visual: ${unit.visual_prompt}`,
      `- Camera: ${unit.camera_suggestion}`,
      `- Production Prompt:\n${unit.production_prompt}`,
      `- QA: ${unit.qa_flags.join('；') || '无'}`,
      '',
    ]).flat(),
    '## QA 报告',
    ...(pkg.qa_report.issues.length ? pkg.qa_report.issues.map(issue => `- ${issue}`) : ['- 无']),
    '',
  ];
  return lines.join('\n');
}
