import type {
  SeedanceShotLedger,
  SeedanceShotLedgerItem,
  SeedanceShotRetryPackage,
  SeedanceShotRetryPackageShot,
  StoryProductionBoardShotUnit,
  StoryProjectMeta,
} from '@shared/types.js';
import { seedanceShotProductionId } from './production-board-service.js';
import { seedanceShotStatusText } from './seedance-provider-callback-policy-service.js';
import { seedanceShotRetrySuggestedAction } from './seedance-provider-queue-service.js';

export function shouldRetrySeedanceShot(item?: SeedanceShotLedgerItem): boolean {
  if (!item) return true;
  if (item.status === 'skipped') return false;
  if (item.status === 'ready' && item.video_url) return false;
  return true;
}

export function selectSeedanceRetryPackageShots(input: {
  shotUnits: StoryProductionBoardShotUnit[];
  ledger: SeedanceShotLedger;
}): {
  shots: SeedanceShotRetryPackageShot[];
  missingPromptShots: SeedanceShotRetryPackage['missing_prompt_shots'];
} {
  const ledgerMap = new Map(input.ledger.items.map(item => [item.production_id, item]));
  const promptKeys = new Set<string>();
  const shots = input.shotUnits.reduce<SeedanceShotRetryPackageShot[]>((items, unit) => {
    const productionId = seedanceShotProductionId(unit.shot_id);
    promptKeys.add(productionId);
    const item = ledgerMap.get(productionId);
    if (!shouldRetrySeedanceShot(item)) return items;
    items.push({
      production_id: productionId,
      shot_id: unit.shot_id,
      source_scene_id: unit.source_scene_id,
      status: item?.status ?? 'prompt_exported',
      retry_count: item?.retry_count ?? 0,
      failure_reason: item?.failure_reason,
      failure_category: item?.failure_category,
      provider_error_code: item?.provider_error_code,
      provider_job_id: item?.provider_job_id,
      last_video_url: item?.video_url,
      suggested_action: seedanceShotRetrySuggestedAction(item),
      prompt: {
        duration_sec: unit.seedance_duration_sec,
        characters: unit.characters,
        location: unit.location,
        script_text: unit.script_text,
        visual_prompt: unit.visual_prompt,
        camera_suggestion: unit.camera_suggestion,
        seedance_prompt: unit.seedance_prompt,
        seedance_asset_slots: unit.seedance_asset_slots,
        seedance_validation_notes: unit.seedance_validation_notes,
        negative_constraints: unit.negative_constraints,
      },
    });
    return items;
  }, []);
  const missingPromptShots = input.ledger.items
    .filter(item => shouldRetrySeedanceShot(item))
    .filter(item => !promptKeys.has(item.production_id))
    .map(item => ({
      production_id: item.production_id,
      shot_id: item.shot_id,
      source_scene_id: item.source_scene_id,
      reason: '账本中存在待处理镜头，但当前 Production Board 找不到对应镜头',
    }));
  return { shots, missingPromptShots };
}

export function buildSeedanceRetryPackage(input: {
  project: StoryProjectMeta;
  storyId: string;
  title: string;
  exportedAt: string;
  shotUnits: StoryProductionBoardShotUnit[];
  ledger: SeedanceShotLedger;
}): SeedanceShotRetryPackage {
  const selection = selectSeedanceRetryPackageShots({
    shotUnits: input.shotUnits,
    ledger: input.ledger,
  });
  const basePackage: Omit<SeedanceShotRetryPackage, 'markdown'> = {
    schema_version: 'story-seedance-retry-package/v1',
    project: input.project,
    storyId: input.storyId,
    title: input.title,
    exported_at: input.exportedAt,
    total_retry_shot_count: selection.shots.length,
    skipped_ready_shot_count: input.ledger.items.filter(item =>
      item.status === 'ready' && Boolean(item.video_url)
    ).length,
    shots: selection.shots,
    missing_prompt_shots: selection.missingPromptShots,
  };
  return {
    ...basePackage,
    markdown: buildSeedanceRetryPackageMarkdown(basePackage),
  };
}

export function buildSeedanceRetryPackageMarkdown(
  pkg: Omit<SeedanceShotRetryPackage, 'markdown'>,
): string {
  const lines = [
    `# ${pkg.title} — Seedance 重试提交包`,
    '',
    `> schema: ${pkg.schema_version}`,
    `> projectId: ${pkg.project.project_id}`,
    `> storyId: ${pkg.storyId}`,
    `> exportedAt: ${pkg.exported_at}`,
    `> 待重试镜头: ${pkg.total_retry_shot_count}`,
    `> 已跳过可用镜头: ${pkg.skipped_ready_shot_count}`,
    '',
    '## 重试镜头',
  ];
  for (const shot of pkg.shots) {
    lines.push(
      '',
      `### ${shot.shot_id} / 场景 ${shot.source_scene_id ?? '未记录'}`,
      '',
      `- 状态: ${seedanceShotStatusText(shot.status)}`,
      `- 失败原因: ${shot.failure_reason ?? '未记录'}`,
      `- 失败分类: ${shot.failure_category ?? '未分类'}`,
      `- Provider 错误码: ${shot.provider_error_code ?? '未记录'}`,
      `- 重试次数: ${shot.retry_count}`,
      `- 上次 job: ${shot.provider_job_id ?? '未记录'}`,
      `- 上次视频: ${shot.last_video_url ?? '未记录'}`,
      `- 建议动作: ${shot.suggested_action}`,
      `- 人物: ${shot.prompt.characters.join('、') || '未指定'}`,
      `- 场景: ${shot.prompt.location}`,
      `- 镜头: ${shot.prompt.camera_suggestion}`,
      shot.prompt.seedance_asset_slots.length
        ? `- 素材: ${shot.prompt.seedance_asset_slots.map(slot => `${slot.reference_slot}=${slot.label}`).join('；')}`
        : '- 素材: 未记录',
      shot.prompt.negative_constraints.length
        ? `- 禁止: ${shot.prompt.negative_constraints.join('；')}`
        : '- 禁止: 无',
      '',
      '```text',
      shot.prompt.seedance_prompt,
      '```',
    );
  }
  if (pkg.missing_prompt_shots.length) {
    lines.push(
      '',
      '## 缺少提示词的待处理镜头',
      '',
      ...pkg.missing_prompt_shots.map(item =>
        `- ${item.shot_id} / 场景 ${item.source_scene_id ?? '未记录'}：${item.reason}`
      ),
    );
  }
  return lines.join('\n');
}
