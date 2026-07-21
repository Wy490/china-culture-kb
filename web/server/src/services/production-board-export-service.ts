import type {
  StoryProductionBoard,
  StoryProductionBoardExportFile,
} from '@shared/types.js';

export interface ProductionBoardExportFileDefinition {
  fileId: string;
  kind: StoryProductionBoardExportFile['kind'];
  label: string;
  filename: string;
  content: string;
  mimeType: string;
}

export function buildProductionBoardSeedanceExport(board: StoryProductionBoard) {
  return {
    schema_version: 'story-production-board-seedance-prompts/v1',
    project_id: board.project_id,
    storyId: board.storyId,
    title: board.title,
    generated_at: board.generated_at,
    delivery_stage: board.delivery_manifest.stage,
    shot_count: board.shot_units.length,
    shot_units: board.shot_units.map(unit => ({
      shot_id: unit.shot_id,
      source_scene_id: unit.source_scene_id,
      duration_sec: unit.seedance_duration_sec,
      characters: unit.characters,
      location: unit.location,
      prompt: unit.seedance_prompt,
      asset_slots: unit.seedance_asset_slots,
      material_validation: unit.seedance_material_validation,
      validation_notes: unit.seedance_validation_notes,
    })),
  };
}

export function buildProductionBoardSeedanceMarkdown(board: StoryProductionBoard): string {
  const lines = [
    `# ${board.title} Seedance 2.0 镜头提示词`,
    '',
    `- 项目 ID: ${board.project_id ?? '未记录'}`,
    `- 故事 ID: ${board.storyId}`,
    `- 交付阶段: ${board.delivery_manifest.stage_label}`,
    `- 镜头数: ${board.shot_units.length}`,
    '',
    ...board.shot_units.flatMap(unit => [
      `## ${unit.shot_id} / 场景 ${unit.source_scene_id}`,
      `- 时长: ${unit.seedance_duration_sec} 秒`,
      `- 场景: ${unit.location}`,
      `- 角色: ${unit.characters.join('、') || '未指定'}`,
      unit.seedance_asset_slots.length
        ? `- 素材 slot: ${unit.seedance_asset_slots.map(slot => `${slot.reference_slot}=${slot.label}`).join('；')}`
        : '- 素材 slot: 无',
      `- 素材校验: 文件 ${unit.seedance_material_validation.total_file_count}/${unit.seedance_material_validation.max_total_files}；复杂度 ${unit.seedance_material_validation.prompt_complexity_score}/100；风险 ${unit.seedance_material_validation.duration_risk}`,
      unit.seedance_validation_notes.length
        ? `- 校验: ${unit.seedance_validation_notes.join('；')}`
        : '- 校验: 无',
      '',
      unit.seedance_prompt,
      '',
    ]),
  ];
  return lines.join('\n');
}

export function buildSeedanceShotLedgerMarkdown(board: StoryProductionBoard): string {
  const lines = [
    `# ${board.title} Seedance Shot Ledger`,
    '',
    `- 项目 ID: ${board.project_id ?? '未记录'}`,
    `- 故事 ID: ${board.storyId}`,
    `- 镜头数: ${board.seedance_shot_ledger.items.length}`,
    `- 已完成: ${board.seedance_shot_ledger.items.filter(item => item.status === 'ready').length}`,
    `- 处理中: ${board.seedance_shot_ledger.items.filter(item => item.status === 'processing').length}`,
    `- 失败: ${board.seedance_shot_ledger.items.filter(item => item.status === 'failed').length}`,
    '',
    ...board.seedance_shot_ledger.items.flatMap(item => [
      `## ${item.shot_id}`,
      `- 状态: ${item.status}`,
      `- 场景: ${item.source_scene_id ?? '未记录'}`,
      `- 更新时间: ${item.updated_at}`,
      item.provider_job_id ? `- Provider Job: ${item.provider_job_id}` : '- Provider Job: 未记录',
      item.video_url ? `- 视频 URL: ${item.video_url}` : '- 视频 URL: 未记录',
      item.selected_version_id ? `- 剪辑版: ${item.selected_version_id}` : '- 剪辑版: 未选择',
      `- 重试次数: ${item.retry_count}`,
      item.notes.length ? `- 备注: ${item.notes.join('；')}` : '- 备注: 无',
      item.versions.length
        ? `- 版本: ${item.versions.map(version => `${version.version_id}/${version.status}`).join('；')}`
        : '- 版本: 无',
      '',
    ]),
  ];
  return lines.join('\n');
}

export function buildProductionBoardExportFileDefinitions(
  board: StoryProductionBoard,
): ProductionBoardExportFileDefinition[] {
  return [
    {
      fileId: 'production-board-json',
      kind: 'board_json',
      label: 'Production Board JSON',
      filename: 'production-board.json',
      content: JSON.stringify(board, null, 2),
      mimeType: 'application/json',
    },
    {
      fileId: 'production-board-markdown',
      kind: 'board_markdown',
      label: 'Production Board Markdown',
      filename: 'production-board.md',
      content: board.markdown,
      mimeType: 'text/markdown',
    },
    {
      fileId: 'supervision-report',
      kind: 'supervision_report',
      label: 'Supervision Report',
      filename: 'supervision-report.json',
      content: JSON.stringify(board.supervision_report, null, 2),
      mimeType: 'application/json',
    },
    {
      fileId: 'repair-plan',
      kind: 'repair_plan',
      label: 'Production Repair Plan',
      filename: 'repair-plan.json',
      content: JSON.stringify(board.repair_plan, null, 2),
      mimeType: 'application/json',
    },
    {
      fileId: 'seedance-prompts-json',
      kind: 'seedance_prompts',
      label: 'Seedance 2.0 Shot Prompts JSON',
      filename: 'seedance-prompts.json',
      content: JSON.stringify(buildProductionBoardSeedanceExport(board), null, 2),
      mimeType: 'application/json',
    },
    {
      fileId: 'seedance-prompts-markdown',
      kind: 'seedance_prompts',
      label: 'Seedance 2.0 Shot Prompts Markdown',
      filename: 'seedance-prompts.md',
      content: buildProductionBoardSeedanceMarkdown(board),
      mimeType: 'text/markdown',
    },
    {
      fileId: 'seedance-asset-report-json',
      kind: 'seedance_asset_report',
      label: 'Seedance Asset Report JSON',
      filename: 'seedance-asset-report.json',
      content: JSON.stringify(board.seedance_asset_report, null, 2),
      mimeType: 'application/json',
    },
    {
      fileId: 'seedance-asset-report-markdown',
      kind: 'seedance_asset_report',
      label: 'Seedance Asset Report Markdown',
      filename: 'seedance-asset-report.md',
      content: board.seedance_asset_report.markdown,
      mimeType: 'text/markdown',
    },
    {
      fileId: 'media-asset-library-json',
      kind: 'media_asset_library',
      label: 'Media Asset Library JSON',
      filename: 'media-asset-library.json',
      content: JSON.stringify(board.media_asset_library, null, 2),
      mimeType: 'application/json',
    },
    {
      fileId: 'image-asset-job-plan-json',
      kind: 'image_asset_job_plan',
      label: 'Image Asset Job Plan JSON',
      filename: 'image-asset-job-plan.json',
      content: JSON.stringify(board.image_asset_job_plan, null, 2),
      mimeType: 'application/json',
    },
    {
      fileId: 'seedance-shot-ledger-json',
      kind: 'seedance_shot_ledger',
      label: 'Seedance Shot Ledger JSON',
      filename: 'seedance-shot-ledger.json',
      content: JSON.stringify(board.seedance_shot_ledger, null, 2),
      mimeType: 'application/json',
    },
    {
      fileId: 'seedance-shot-ledger-markdown',
      kind: 'seedance_shot_ledger',
      label: 'Seedance Shot Ledger Markdown',
      filename: 'seedance-shot-ledger.md',
      content: buildSeedanceShotLedgerMarkdown(board),
      mimeType: 'text/markdown',
    },
  ];
}

export function buildProductionBoardDeliveryManifestDefinition(input: {
  projectId: string;
  board: StoryProductionBoard;
  exportedAt: string;
  files: StoryProductionBoardExportFile[];
}): ProductionBoardExportFileDefinition {
  return {
    fileId: 'delivery-manifest',
    kind: 'delivery_manifest',
    label: 'Delivery Manifest',
    filename: 'manifest.json',
    content: JSON.stringify({
      schema_version: 'story-production-board-manifest/v1',
      project_id: input.projectId,
      storyId: input.board.storyId,
      title: input.board.title,
      exported_at: input.exportedAt,
      delivery_manifest: input.board.delivery_manifest,
      files: input.files,
    }, null, 2),
    mimeType: 'application/json',
  };
}
