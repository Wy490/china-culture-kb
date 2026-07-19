import type {
  GearsExternalCallbackHandoffItem,
  GearsExternalCallbackHandoffPackage,
  GearsJobCallbackRequest,
  GearsJobLedger,
  GearsJobLedgerItem,
  SeedanceShotRetryPrompt,
  StoryProductionBoardShotUnit,
  StoryProjectMeta,
} from '@shared/types.js';
import {
  LOCAL_GEARS_ACCEPTANCE_ARTIFACT_BASE_URL,
  artifactIsLocalAcceptance,
  gearsJobHasExternalArtifact,
  gearsJobHasLocalAcceptanceArtifact,
} from './gears-external-artifact-policy-service.js';

export function gearsJobLocalAcceptanceArtifactUrls(item: GearsJobLedgerItem): string[] {
  const structured = (item.artifacts ?? [])
    .filter(artifact => artifactIsLocalAcceptance(artifact))
    .map(artifact => artifact.url);
  const urls = item.artifact_urls.filter(url =>
    url.startsWith(LOCAL_GEARS_ACCEPTANCE_ARTIFACT_BASE_URL)
  );
  return [...new Set([...structured, ...urls])];
}

export function gearsJobExternalArtifactUrls(item: GearsJobLedgerItem): string[] {
  const structured = (item.artifacts ?? [])
    .filter(artifact => !artifactIsLocalAcceptance(artifact))
    .map(artifact => artifact.url);
  const urls = item.artifact_urls.filter(url =>
    !url.startsWith(LOCAL_GEARS_ACCEPTANCE_ARTIFACT_BASE_URL)
  );
  return [...new Set([...structured, ...urls])];
}

export function gearsExternalCallbackSample(input: {
  project: StoryProjectMeta;
  storyId: string;
  item: GearsJobLedgerItem;
}): GearsJobCallbackRequest {
  const placeholderUrl = `https://gears.example/videos/${encodeURIComponent(input.project.project_id)}-${encodeURIComponent(input.item.source_unit_id)}.mp4`;
  return {
    jobId: input.item.gears_job_id,
    sourceUnitId: input.item.source_unit_id,
    jobType: input.item.job_type,
    sourceProjectId: input.project.project_id,
    sourceStoryId: input.storyId,
    taskStatus: 'COMPLETED',
    progressPercent: 100,
    outputUrl: placeholderUrl,
    eventId: `external-ready-${input.item.source_unit_id}`,
    note: 'Replace outputUrl with the real GEARS/Seedance artifact URL before callback import.',
  };
}

export function gearsExternalCallbackBatchSample(
  items: GearsExternalCallbackHandoffItem[],
): GearsExternalCallbackHandoffPackage['callback_batch_sample'] {
  return {
    callbacks: items.map(item => item.callback_sample),
    replace_before_import: [
      'callbacks[].outputUrl must be replaced with the real GEARS/Seedance artifact URL.',
      'callbacks[].outputUrl must be an absolute public http(s) URL, not localhost, a private network URL, local_acceptance, or a local file path.',
      'callbacks[].eventId should be unique for every external provider callback.',
      'Do not submit local_acceptance artifact URLs as external outputUrl values.',
    ],
    import_note: 'This payload is a batch callback sample for the safe external callback import endpoint.',
  };
}

export function gearsExternalSafeImportPath(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/production-board/gears-jobs/import-external-callbacks`;
}

export function gearsExternalPreflightPath(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/production-board/gears-jobs/preflight-external-callbacks`;
}

export function gearsExternalOperationUrl(input: {
  callbackPath: string;
  callbackUrl: string;
  operationPath: string;
}): string {
  if (!/^https?:\/\//.test(input.callbackUrl)) return input.operationPath;
  try {
    const url = new URL(input.callbackUrl);
    const callbackPathname = new URL(input.callbackPath, url.origin).pathname;
    const operationPathname = new URL(input.operationPath, url.origin).pathname;
    if (url.pathname.endsWith(callbackPathname)) {
      const publicPathPrefix = url.pathname
        .slice(0, url.pathname.length - callbackPathname.length)
        .replace(/\/+$/, '');
      return `${url.origin}${publicPathPrefix}${operationPathname}`;
    }
    return `${url.origin}${operationPathname}`;
  } catch {
    return input.operationPath;
  }
}

export function gearsExternalCallbackCurlCommand(input: {
  projectId: string;
  targetPath: string;
  targetUrl: string;
}): string {
  const target = /^https?:\/\//.test(input.targetUrl)
    ? input.targetUrl
    : `$STORY_AGENT_BASE_URL${input.targetPath}`;
  const fileName = `${input.projectId}-gears-external-callbacks.json`;
  return `curl -sS -X POST "${target}" -H "content-type: application/json" --data-binary @${fileName}`;
}

export function gearsExternalOperatorChecklist(): string[] {
  return [
    'Render or collect the real external GEARS/Seedance artifact for each sourceUnitId.',
    'Replace every sample outputUrl with the real artifact URL before importing callbacks.',
    'Use absolute public http(s) outputUrl values; do not use localhost, private network, local_acceptance, file, or relative URLs.',
    'Keep jobId, sourceUnitId, jobType, sourceProjectId and sourceStoryId unchanged unless the worker remaps ids intentionally.',
    'Use a unique eventId per callback to preserve callback idempotency and lifecycle history.',
    'POST the batch payload to the preflight endpoint first and continue only when blocking_count is 0.',
    'POST the same batch payload to the safe import endpoint after preflight passes; it runs preflight again before writing ledgers.',
    'After import, re-run project production readiness and confirm external_ready increases while ready_without_external decreases.',
  ];
}

export function gearsExternalHandoffPrompt(
  shot: StoryProductionBoardShotUnit | undefined,
): SeedanceShotRetryPrompt | undefined {
  if (!shot) return undefined;
  return {
    duration_sec: shot.seedance_duration_sec,
    characters: shot.characters,
    location: shot.location,
    script_text: shot.script_text,
    visual_prompt: shot.visual_prompt,
    camera_suggestion: shot.camera_suggestion,
    seedance_prompt: shot.seedance_prompt,
    seedance_asset_slots: shot.seedance_asset_slots,
    seedance_validation_notes: shot.seedance_validation_notes,
    negative_constraints: shot.negative_constraints,
  };
}

export function buildGearsExternalCallbackHandoffItems(input: {
  project: StoryProjectMeta;
  storyId: string;
  ledger: GearsJobLedger;
  shotUnits: StoryProductionBoardShotUnit[];
  callbackPath: string;
  callbackUrl: string;
}): GearsExternalCallbackHandoffItem[] {
  const shotById = new Map(input.shotUnits.map(shot => [shot.shot_id, shot]));
  return input.ledger.items
    .filter(item =>
      item.job_type === 'seedance_video'
      && !['failed', 'rejected', 'canceled'].includes(item.status)
      && !gearsJobHasExternalArtifact(item)
    )
    .map(item => {
      const shot = shotById.get(item.source_unit_id);
      return {
        source_unit_id: item.source_unit_id,
        gears_job_id: item.gears_job_id,
        job_type: item.job_type,
        status: item.status,
        source_scene_id: item.source_scene_id ?? shot?.source_scene_id,
        source_unit_label: item.source_unit_label,
        local_acceptance_artifact_urls: gearsJobLocalAcceptanceArtifactUrls(item),
        external_artifact_urls: gearsJobExternalArtifactUrls(item),
        requires_external_artifact: true,
        callback_path: input.callbackPath,
        callback_url: input.callbackUrl,
        callback_sample: gearsExternalCallbackSample({
          project: input.project,
          storyId: input.storyId,
          item,
        }),
        prompt: gearsExternalHandoffPrompt(shot),
      };
    });
}

export function buildGearsExternalCallbackHandoffPackage(input: {
  project: StoryProjectMeta;
  storyId: string;
  title: string;
  exportedAt: string;
  ledger: GearsJobLedger;
  shotUnits: StoryProductionBoardShotUnit[];
  callbackPath: string;
  callbackUrl: string;
}): GearsExternalCallbackHandoffPackage {
  const preflightPath = gearsExternalPreflightPath(input.project.project_id);
  const preflightUrl = gearsExternalOperationUrl({
    callbackPath: input.callbackPath,
    callbackUrl: input.callbackUrl,
    operationPath: preflightPath,
  });
  const safeImportPath = gearsExternalSafeImportPath(input.project.project_id);
  const safeImportUrl = gearsExternalOperationUrl({
    callbackPath: input.callbackPath,
    callbackUrl: input.callbackUrl,
    operationPath: safeImportPath,
  });
  const items = buildGearsExternalCallbackHandoffItems({
    project: input.project,
    storyId: input.storyId,
    ledger: input.ledger,
    shotUnits: input.shotUnits,
    callbackPath: input.callbackPath,
    callbackUrl: input.callbackUrl,
  });
  const basePackage: Omit<GearsExternalCallbackHandoffPackage, 'markdown'> = {
    schema_version: 'project-gears-external-callback-handoff/v1',
    project: input.project,
    storyId: input.storyId,
    title: input.title,
    exported_at: input.exportedAt,
    callback_path: input.callbackPath,
    callback_url: input.callbackUrl,
    preflight_path: preflightPath,
    preflight_url: preflightUrl,
    safe_import_path: safeImportPath,
    safe_import_url: safeImportUrl,
    total_job_count: input.ledger.items.length,
    external_ready_count: input.ledger.items.filter(item =>
      item.status === 'ready' && gearsJobHasExternalArtifact(item)
    ).length,
    local_acceptance_ready_count: input.ledger.items.filter(item =>
      item.status === 'ready' && gearsJobHasLocalAcceptanceArtifact(item)
    ).length,
    pending_external_artifact_count: items.length,
    callback_batch_sample: gearsExternalCallbackBatchSample(items),
    callback_batch_preflight_curl: gearsExternalCallbackCurlCommand({
      projectId: input.project.project_id,
      targetPath: preflightPath,
      targetUrl: preflightUrl,
    }),
    callback_batch_curl: gearsExternalCallbackCurlCommand({
      projectId: input.project.project_id,
      targetPath: safeImportPath,
      targetUrl: safeImportUrl,
    }),
    operator_checklist: gearsExternalOperatorChecklist(),
    items,
  };
  return {
    ...basePackage,
    markdown: buildGearsExternalCallbackHandoffMarkdown(basePackage),
  };
}

export function buildGearsExternalCallbackHandoffMarkdown(
  pkg: Omit<GearsExternalCallbackHandoffPackage, 'markdown'>,
): string {
  const lines = [
    `# ${pkg.title} — GEARS 外部回片交接包`,
    '',
    `> schema: ${pkg.schema_version}`,
    `> projectId: ${pkg.project.project_id}`,
    `> storyId: ${pkg.storyId}`,
    `> exportedAt: ${pkg.exported_at}`,
    `> callbackPath: ${pkg.callback_path}`,
    `> callbackUrl: ${pkg.callback_url}`,
    `> preflightPath: ${pkg.preflight_path}`,
    `> preflightUrl: ${pkg.preflight_url}`,
    `> safeImportPath: ${pkg.safe_import_path}`,
    `> safeImportUrl: ${pkg.safe_import_url}`,
    `> 待外部 artifact: ${pkg.pending_external_artifact_count}`,
    `> 本地验收 ready: ${pkg.local_acceptance_ready_count}`,
    `> 外部 ready: ${pkg.external_ready_count}`,
    '',
    '## 使用边界',
    '',
    '- 本包用于把 local_acceptance 或尚未回片的 GEARS job 升级为真实外部 artifact。',
    '- 回传前必须把 sample 中的 outputUrl 替换成真实 GEARS/Seedance 产物 URL。',
    '- local_acceptance URL 只代表本地链路验收，不代表外部平台真实回片。',
    '',
    '## Operator Checklist',
    '',
    ...pkg.operator_checklist.map(item => `- ${item}`),
    '',
    '## 批量回传 payload',
    '',
    'Preflight curl:',
    '',
    '```bash',
    pkg.callback_batch_preflight_curl,
    '```',
    '',
    'Safe import curl:',
    '',
    '```bash',
    pkg.callback_batch_curl,
    '```',
    '',
    'Batch callback sample:',
    '',
    '```json',
    JSON.stringify(pkg.callback_batch_sample, null, 2),
    '```',
    '',
    '## 待回片镜头',
  ];
  for (const item of pkg.items) {
    lines.push(
      '',
      `### ${item.source_unit_id} / ${item.gears_job_id}`,
      '',
      `- 状态: ${item.status}`,
      `- 场景: ${item.source_scene_id ?? '未记录'}`,
      `- callback: ${item.callback_path}`,
      `- 本地验收 artifact: ${item.local_acceptance_artifact_urls.join('；') || '无'}`,
      `- 外部 artifact: ${item.external_artifact_urls.join('；') || '待补'}`,
      item.prompt ? `- 人物: ${item.prompt.characters.join('、') || '未指定'}` : '- 人物: 未记录',
      item.prompt ? `- 场景: ${item.prompt.location}` : '- 场景: 未记录',
      item.prompt ? `- 镜头: ${item.prompt.camera_suggestion}` : '- 镜头: 未记录',
      item.prompt?.seedance_asset_slots.length
        ? `- 素材: ${item.prompt.seedance_asset_slots.map(slot => `${slot.reference_slot}=${slot.label}`).join('；')}`
        : '- 素材: 未记录',
      '',
      'Callback sample:',
      '',
      '```json',
      JSON.stringify(item.callback_sample, null, 2),
      '```',
    );
    if (item.prompt) {
      lines.push(
        '',
        'Seedance prompt:',
        '',
        '```text',
        item.prompt.seedance_prompt,
        '```',
      );
    }
  }
  if (!pkg.items.length) {
    lines.push('', '- 当前没有缺少外部 artifact 的 GEARS job。');
  }
  return lines.join('\n');
}
