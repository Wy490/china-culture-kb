import type {
  GearsCharacterAsset,
  GearsDeliveryPackage,
  GearsSceneAsset,
  GearsSegment,
  StoryGenerateResult,
  StoryProductionBoard,
  StoryProductionBoardRepairAction,
  StoryProductionBoardRepairRequest,
  StoryProductionBoardRepairTask,
  StoryProductionBoardRepairTrace,
  StoryProductionBoardSupervisionIssue,
  StoryScene,
} from '@shared/types.js';
import { buildGearsDeliveryPackage, ensureGearsDeliveryPackage } from './gears-delivery-service.js';
import { enrichStoryQualityReport } from './quality-workflow-service.js';
import { buildStoryProductionBoard } from './production-board-service.js';

export function repairStoryWithProductionBoard(
  story: StoryGenerateResult,
  request: StoryProductionBoardRepairRequest = {},
): {
  story: StoryGenerateResult;
  beforeBoard: StoryProductionBoard;
  afterBoard: StoryProductionBoard;
  trace: StoryProductionBoardRepairTrace;
} {
  const beforeBoard = buildStoryProductionBoard(story);
  const selectedTasks = selectProductionRepairTasks(beforeBoard, request);
  const appliedTaskIds: string[] = [];
  const skippedTaskIds: string[] = [];
  let nextStory: StoryGenerateResult = {
    ...story,
    scene_breakdown: story.scene_breakdown.map(scene => ({ ...scene })),
    gears_segments: story.gears_segments.map(segment => ({ ...segment })),
    characters: story.characters?.map(character => ({ ...character })),
    gears_delivery: cloneGearsDelivery(ensureGearsDeliveryPackage(story)),
  };

  for (const task of selectedTasks) {
    const before = JSON.stringify(projectRepairComparableState(nextStory));
    nextStory = applyProductionRepairTask(nextStory, beforeBoard, task);
    const after = JSON.stringify(projectRepairComparableState(nextStory));
    if (after !== before) {
      appliedTaskIds.push(task.task_id);
    } else {
      skippedTaskIds.push(task.task_id);
    }
  }

  if (nextStory.quality_report) {
    nextStory.quality_report = enrichStoryQualityReport({
      story: nextStory,
      qualityReport: nextStory.quality_report,
      gearsDelivery: nextStory.gears_delivery,
    });
  }

  const afterBoard = buildStoryProductionBoard(nextStory);
  const changedSceneIds = collectChangedSceneIds(story, nextStory);
  const appliedActions = uniqueActions(selectedTasks.filter(task => appliedTaskIds.includes(task.task_id)));
  const trace: StoryProductionBoardRepairTrace = {
    trace_id: `${story.storyId}--production-board-repair-${Date.now()}`,
    attempted: true,
    applied: appliedTaskIds.length > 0,
    reason: appliedTaskIds.length > 0 ? 'production_board_repair_applied' : 'no_production_board_changes',
    before_stage: beforeBoard.delivery_manifest.stage,
    after_stage: afterBoard.delivery_manifest.stage,
    before_blockers: beforeBoard.supervision_report.blockers,
    after_blockers: afterBoard.supervision_report.blockers,
    applied_task_ids: appliedTaskIds,
    skipped_task_ids: skippedTaskIds,
    applied_actions: appliedActions,
    changed_scene_ids: changedSceneIds,
    note: buildProductionRepairNote(appliedActions, beforeBoard, afterBoard),
  };

  return {
    story: {
      ...nextStory,
      production_board_repair_trace: [...(story.production_board_repair_trace ?? []), trace],
    },
    beforeBoard,
    afterBoard,
    trace,
  };
}

function selectProductionRepairTasks(
  board: StoryProductionBoard,
  request: StoryProductionBoardRepairRequest,
): StoryProductionBoardRepairTask[] {
  const tasks = board.repair_plan.tasks;
  let selected = tasks;

  if (request.task_ids?.length) {
    const ids = new Set(request.task_ids);
    selected = selected.filter(task => ids.has(task.task_id));
  }
  if (request.actions?.length) {
    const actions = new Set(request.actions);
    selected = selected.filter(task => actions.has(task.action));
  }
  if (request.priorities?.length) {
    const priorities = new Set(request.priorities);
    selected = selected.filter(task => priorities.has(task.priority));
  }
  if (!hasExplicitProductionRepairSelection(request)) {
    if (request.apply_all) return tasks;
    const blockers = tasks.filter(task => task.priority === 'P0');
    selected = blockers.length ? blockers : tasks;
  }

  return selected
    .map(task => scopeProductionRepairTask(board, task, request))
    .filter((task): task is StoryProductionBoardRepairTask => Boolean(task));
}

function hasExplicitProductionRepairSelection(request: StoryProductionBoardRepairRequest): boolean {
  return Boolean(
    request.task_ids?.length
    || request.actions?.length
    || request.priorities?.length
    || request.categories?.length
    || request.shot_ids?.length
    || request.scene_ids?.length,
  );
}

function scopeProductionRepairTask(
  board: StoryProductionBoard,
  task: StoryProductionBoardRepairTask,
  request: StoryProductionBoardRepairRequest,
): StoryProductionBoardRepairTask | null {
  if (!request.categories?.length && !request.shot_ids?.length && !request.scene_ids?.length) {
    return task;
  }

  const taskIssueIds = new Set(task.target_issue_ids);
  const targetIssues = board.supervision_report.issues.filter(issue =>
    taskIssueIds.has(issue.issue_id) && productionRepairIssueMatchesRequest(issue, request),
  );
  if (!targetIssues.length) return null;

  return {
    ...task,
    target_issue_ids: targetIssues.map(issue => issue.issue_id),
    target_shot_ids: uniqueStrings(targetIssues.map(issue => issue.source_shot_id).filter((id): id is string => Boolean(id))),
    target_scene_ids: [...new Set(targetIssues.map(issue => issue.source_scene_id).filter((id): id is number => typeof id === 'number'))]
      .sort((a, b) => a - b),
  };
}

function productionRepairIssueMatchesRequest(
  issue: StoryProductionBoardSupervisionIssue,
  request: StoryProductionBoardRepairRequest,
): boolean {
  if (request.categories?.length && !request.categories.includes(issue.category)) return false;

  const hasTargetScope = Boolean(request.shot_ids?.length || request.scene_ids?.length);
  if (!hasTargetScope) return true;

  const shotMatches = issue.source_shot_id ? request.shot_ids?.includes(issue.source_shot_id) : false;
  const sceneMatches = typeof issue.source_scene_id === 'number'
    ? request.scene_ids?.includes(issue.source_scene_id)
    : false;
  return Boolean(shotMatches || sceneMatches);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
}

function applyProductionRepairTask(
  story: StoryGenerateResult,
  board: StoryProductionBoard,
  task: StoryProductionBoardRepairTask,
): StoryGenerateResult {
  if (task.action === 'normalize_period_costumes') return normalizePeriodCostumes(story, board, task);
  if (task.action === 'register_asset') return registerMissingAssets(story, board, task);
  if (task.action === 'clean_prompt') return cleanProductionPrompts(story, task);
  if (task.action === 'strengthen_filmability') return strengthenFilmability(story, task);
  if (task.action === 'add_continuity') return addContinuityHints(story, task);
  return splitLongDurationHints(story, task);
}

function normalizePeriodCostumes(
  story: StoryGenerateResult,
  board: StoryProductionBoard,
  task: StoryProductionBoardRepairTask,
): StoryGenerateResult {
  const period = inferRepairPeriod(board) ?? '宋';
  const clothing = periodClothing(period);
  const targetNames = new Set(
    board.supervision_report.issues
      .filter(issue => issue.category === 'period')
      .map(issue => issue.title.replace(/^服饰时代错配：/, '').trim())
      .filter(Boolean),
  );
  const delivery = story.gears_delivery ?? buildGearsDeliveryPackage(story);
  const characterAssets = mergeCharacterAssets(
    delivery.character_assets,
    board.character_assets.map(asset => targetNames.has(asset.name) ? { ...asset, clothing } : asset),
  ).map(asset => targetNames.size === 0 || targetNames.has(asset.name)
    ? { ...asset, clothing }
    : asset);
  const characters = story.characters?.map(character => targetNames.has(character.name)
    ? {
        ...character,
        description: appendUniqueSentence(removePeriodMismatchText(character.description), `${character.name}服饰改为${clothing}`),
      }
    : character);

  return {
    ...story,
    characters,
    scene_breakdown: story.scene_breakdown.map(scene => repairSceneCostumeText(scene, targetNames, period)),
    gears_segments: story.gears_segments.map(segment => ({
      ...segment,
      segment_prompt_hint: appendUniqueSentence(cleanPromptText(segment.segment_prompt_hint ?? ''), `时代服饰统一为${period}语境：${clothing}`),
    })),
    gears_delivery: {
      ...delivery,
      character_assets: characterAssets,
      character_gender_summary: summarizeCharacterGenders(characterAssets),
      validation_notes: delivery.validation_notes.filter(note => !note.includes('服饰')),
      markdown: delivery.markdown,
    },
  };
}

function registerMissingAssets(
  story: StoryGenerateResult,
  board: StoryProductionBoard,
  _task: StoryProductionBoardRepairTask,
): StoryGenerateResult {
  const delivery = story.gears_delivery ?? buildGearsDeliveryPackage(story);
  const characterAssets = mergeCharacterAssets(delivery.character_assets, board.character_assets);
  const sceneAssets = mergeSceneAssets(
    delivery.scene_assets,
    story.scene_breakdown.map(scene => buildSceneAssetFromScene(scene)),
  );
  return {
    ...story,
    gears_delivery: {
      ...delivery,
      character_assets: characterAssets,
      character_gender_summary: summarizeCharacterGenders(characterAssets),
      scene_assets: sceneAssets,
      validation_notes: delivery.validation_notes.filter(note =>
        !note.includes('未命中资产清单') && !note.includes('缺少空间结构'),
      ),
      markdown: delivery.markdown,
    },
  };
}

function cleanProductionPrompts(
  story: StoryGenerateResult,
  task: StoryProductionBoardRepairTask,
): StoryGenerateResult {
  const targetSceneIds = task.target_scene_ids.length ? new Set(task.target_scene_ids) : null;
  return {
    ...story,
    scene_breakdown: story.scene_breakdown.map(scene => {
      if (targetSceneIds && !targetSceneIds.has(scene.scene_id)) return scene;
      return {
        ...scene,
        visual_prompt: cleanPromptText(scene.visual_prompt),
        camera_suggestion: cleanPromptText(scene.camera_suggestion),
      };
    }),
    gears_segments: story.gears_segments.map(segment => {
      if (targetSceneIds && !targetSceneIds.has(segment.source_scene_id)) return segment;
      return {
        ...segment,
        segment_prompt_hint: cleanPromptText(segment.segment_prompt_hint ?? ''),
      };
    }),
  };
}

function strengthenFilmability(
  story: StoryGenerateResult,
  task: StoryProductionBoardRepairTask,
): StoryGenerateResult {
  const targetSceneIds = task.target_scene_ids.length ? new Set(task.target_scene_ids) : null;
  return {
    ...story,
    scene_breakdown: story.scene_breakdown.map(scene => {
      if (targetSceneIds && !targetSceneIds.has(scene.scene_id)) return scene;
      return {
        ...scene,
        key_action: appendUniqueSentence(scene.key_action, '以手部动作、表情变化和道具位置呈现选择压力'),
        visual_prompt: appendUniqueSentence(cleanPromptText(scene.visual_prompt), '加入清晰主体动作、手部细节、道具位置和人物表情'),
        camera_suggestion: appendUniqueSentence(scene.camera_suggestion, '用中近景承接动作，再以特写捕捉表情转折'),
      };
    }),
  };
}

function addContinuityHints(
  story: StoryGenerateResult,
  task: StoryProductionBoardRepairTask,
): StoryGenerateResult {
  const targetSceneIds = task.target_scene_ids.length ? new Set(task.target_scene_ids) : null;
  return {
    ...story,
    gears_segments: story.gears_segments.map(segment => {
      if (targetSceneIds && !targetSceneIds.has(segment.source_scene_id)) return segment;
      const scene = story.scene_breakdown.find(item => item.scene_id === segment.source_scene_id);
      const hint = [
        scene ? `承接场景${scene.scene_id}：${scene.title}` : `承接场景${segment.source_scene_id}`,
        '保持角色服饰、年龄、发型、随身物件与上一镜头一致',
        scene?.factual_basis ? `事实边界：${scene.factual_basis}` : '',
        scene?.fictionalized_elements?.length ? `戏剧化补足：${scene.fictionalized_elements.join('、')}` : '',
      ].filter(Boolean).join('；');
      return {
        ...segment,
        segment_prompt_hint: appendUniqueSentence(cleanPromptText(segment.segment_prompt_hint ?? ''), hint),
      };
    }),
  };
}

function splitLongDurationHints(
  story: StoryGenerateResult,
  task: StoryProductionBoardRepairTask,
): StoryGenerateResult {
  const targetSceneIds = task.target_scene_ids.length ? new Set(task.target_scene_ids) : null;
  return {
    ...story,
    gears_segments: story.gears_segments.map(segment => {
      if (targetSceneIds && !targetSceneIds.has(segment.source_scene_id)) return segment;
      if (segment.duration_sec <= 15) return segment;
      return {
        ...segment,
        segment_prompt_hint: appendUniqueSentence(
          cleanPromptText(segment.segment_prompt_hint ?? ''),
          '0-4秒建立主体与空间；4-9秒推进动作和表情变化；9-15秒完成转折并收束到定格画面',
        ),
      };
    }),
  };
}

function repairSceneCostumeText(scene: StoryScene, targetNames: Set<string>, period: string): StoryScene {
  const clothing = periodClothing(period);
  const replacement = `${period}服饰：${clothing}`;
  const characters = targetNames.size ? [...targetNames].filter(name => scene.characters.includes(name)) : scene.characters;
  if (!characters.length) return scene;
  return {
    ...scene,
    visual_prompt: appendUniqueSentence(removePeriodMismatchText(scene.visual_prompt), replacement),
    cultural_note: appendUniqueSentence(scene.cultural_note, `生产修复：人物服饰统一为${period}语境`),
  };
}

function cleanPromptText(value: string): string {
  return value
    .replace(/生成优先级[:：][^。；\n]*(?:。|；|\n)?/g, '')
    .replace(/本场景基于[^，。；\n]*(?:，具体细节请核实来源)?/g, '')
    .replace(/来源显示[:：][^。；\n]*(?:。|；|\n)?/g, '')
    .replace(/(?:质量|分析|应该|注意|TODO|待补|知识库缺失)[:：]?/g, '')
    .replace(/不可写成已验证史实/g, '保持可信边界')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function removePeriodMismatchText(value: string): string {
  return cleanPromptText(value)
    .replace(/清末民初至五四前后[^，。；\n]*(?:，|。|；)?/g, '')
    .replace(/清末|民初|五四|近代青年|西装|中山装|旗袍/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function appendUniqueSentence(value: string, sentence: string): string {
  const base = value.trim();
  const next = sentence.trim();
  if (!next) return base;
  if (base.includes(next)) return base;
  if (!base) return next;
  return `${base}；${next}`;
}

function buildSceneAssetFromScene(scene: StoryScene): GearsSceneAsset {
  return {
    name: scene.location || scene.title || `场景${scene.scene_id}`,
    scene_type: inferSceneType(scene),
    description: cleanPromptText([
      scene.location,
      scene.visual_prompt,
      scene.plot,
      scene.factual_basis,
    ].filter(Boolean).join('，')).slice(0, 280) || `${scene.location}的空间结构、陈设和光线按分镜补足。`,
    environment_props: inferEnvironmentProps(scene),
    atmosphere: inferAtmosphere(scene),
  };
}

function inferSceneType(scene: StoryScene): GearsSceneAsset['scene_type'] {
  const text = `${scene.location} ${scene.visual_prompt}`;
  if (/堂|衙|书院|室|屋|厅|斋|房|内/.test(text)) return '室内';
  if (/山|水|溪|洞|街|院|桥|田|外|江|湖/.test(text)) return '室外';
  return '不限';
}

function inferAtmosphere(scene: StoryScene): GearsSceneAsset['atmosphere'] {
  const text = `${scene.time_of_day} ${scene.plot} ${scene.conflict ?? ''}`;
  if (/紧张|危机|逼|冲突|拒|追/.test(text)) return '紧张';
  if (/夜|洞|神秘|疑/.test(text)) return '神秘';
  if (/温暖|清晨|明亮/.test(text)) return '明亮';
  return '中性';
}

function inferEnvironmentProps(scene: StoryScene): string | undefined {
  const props = ['案卷', '文书', '判词', '烛火', '书', '毛笔', '灯', '石壁', '溪水', '莲', '桌', '门']
    .filter(prop => `${scene.visual_prompt} ${scene.plot} ${scene.key_action}`.includes(prop));
  return props.length ? [...new Set(props)].slice(0, 6).join('、') : undefined;
}

function mergeCharacterAssets(current: GearsCharacterAsset[], additions: GearsCharacterAsset[]): GearsCharacterAsset[] {
  const byName = new Map(current.map(asset => [asset.name, { ...asset }]));
  for (const asset of additions) {
    byName.set(asset.name, { ...(byName.get(asset.name) ?? asset), ...asset });
  }
  return [...byName.values()];
}

function mergeSceneAssets(current: GearsSceneAsset[], additions: GearsSceneAsset[]): GearsSceneAsset[] {
  const byName = new Map(current.map(asset => [asset.name, { ...asset }]));
  for (const asset of additions) {
    if (!asset.name.trim()) continue;
    byName.set(asset.name, { ...(byName.get(asset.name) ?? asset), ...asset });
  }
  return [...byName.values()];
}

function summarizeCharacterGenders(characters: GearsCharacterAsset[]): GearsDeliveryPackage['character_gender_summary'] {
  return {
    total: characters.length,
    male: characters.filter(character => character.gender === '男').length,
    female: characters.filter(character => character.gender === '女').length,
    other: characters.filter(character => character.gender === '其他').length,
    unspecified: characters.filter(character => character.gender === '未指定').length,
    not_applicable: characters.filter(character => character.gender === '不适用').length,
  };
}

function cloneGearsDelivery(delivery: GearsDeliveryPackage): GearsDeliveryPackage {
  return {
    ...delivery,
    character_assets: delivery.character_assets.map(asset => ({ ...asset })),
    character_gender_summary: { ...delivery.character_gender_summary },
    scene_assets: delivery.scene_assets.map(asset => ({ ...asset })),
    units: delivery.units.map(unit => ({ ...unit, character_names: [...unit.character_names] })),
    validation_notes: [...delivery.validation_notes],
  };
}

function projectRepairComparableState(story: StoryGenerateResult) {
  return {
    characters: story.characters,
    scene_breakdown: story.scene_breakdown,
    gears_segments: story.gears_segments,
    gears_delivery: story.gears_delivery,
  };
}

function collectChangedSceneIds(before: StoryGenerateResult, after: StoryGenerateResult): number[] {
  const changed = new Set<number>();
  const beforeScenes = new Map(before.scene_breakdown.map(scene => [scene.scene_id, JSON.stringify(scene)]));
  for (const scene of after.scene_breakdown) {
    if (beforeScenes.get(scene.scene_id) !== JSON.stringify(scene)) changed.add(scene.scene_id);
  }
  const beforeSegments = new Map(before.gears_segments.map(segment => [segment.source_scene_id, JSON.stringify(segment)]));
  for (const segment of after.gears_segments) {
    if (beforeSegments.get(segment.source_scene_id) !== JSON.stringify(segment)) changed.add(segment.source_scene_id);
  }
  return [...changed].sort((a, b) => a - b);
}

function uniqueActions(tasks: StoryProductionBoardRepairTask[]): StoryProductionBoardRepairAction[] {
  return [...new Set(tasks.map(task => task.action))];
}

function buildProductionRepairNote(
  actions: StoryProductionBoardRepairAction[],
  beforeBoard: StoryProductionBoard,
  afterBoard: StoryProductionBoard,
): string {
  if (!actions.length) return '生产修复未产生可写入变化。';
  const labels: Record<StoryProductionBoardRepairAction, string> = {
    normalize_period_costumes: '时代服饰',
    register_asset: '资产登记',
    clean_prompt: '提示词清理',
    strengthen_filmability: '可拍性',
    add_continuity: '连续性',
    split_duration: '时段拆分',
  };
  return `已修复${actions.map(action => labels[action]).join('、')}；阻断项 ${beforeBoard.supervision_report.blockers} -> ${afterBoard.supervision_report.blockers}；交付阶段 ${beforeBoard.delivery_manifest.stage_label} -> ${afterBoard.delivery_manifest.stage_label}。`;
}

function inferRepairPeriod(board: StoryProductionBoard): string | null {
  const text = [
    ...board.supervision_report.issues.map(issue => `${issue.title} ${issue.detail} ${issue.fix_hint}`),
    ...board.continuity_constraints,
  ].join(' ');
  const match = text.match(/故事时代倾向为([^，。；\s]+)/);
  if (match?.[1]) return match[1];
  if (/周敦颐|濂溪|南安军|宋/.test(text)) return '宋';
  return null;
}

function periodClothing(period: string): string {
  if (period.includes('宋')) return '宋代士人或少年服饰，交领长衫/襦衫，束发或幞头，布履，色彩素雅';
  if (period.includes('唐')) return '唐代圆领袍或襦裙体系，发式和配饰符合唐代语境';
  if (period.includes('明')) return '明代交领袍服或襕衫，发冠、布履和配饰保持明代语境';
  if (period.includes('清')) return '清代长袍马褂或旗装体系，发式与配饰保持清代语境';
  return `${period}语境下的传统服饰，发式、鞋履和随身物件保持同一时代`;
}
