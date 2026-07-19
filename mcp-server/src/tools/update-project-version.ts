type ProjectVersionChangeType = 'scene_regeneration' | 'quality_repair' | 'production_board_repair';

export interface UpdateProjectVersionInput {
  project_id: string;
  change_type: ProjectVersionChangeType;
  change_target?: {
    scene_ids?: number[];
  };
  snapshot_json: string;
  user_instruction?: string;
}

export interface UpdateProjectVersionResult {
  project_id: string;
  previous_version_id: string;
  version_id: string;
  current_version_id: string;
  version_count: number;
  updated_at: string;
  change_type: 'quality_repair';
  scene_ids_changed: number[];
  snapshot_path: string;
  project_path: string;
  preserved_fields: string[];
  quality_summary: {
    quality_passed?: boolean;
    genre_score?: number;
    quality_issue_count?: number;
  };
  warnings: string[];
  canonical_service: true;
  application_endpoint: string;
}

interface ApiEnvelope<T> {
  ok: boolean;
  data: T | null;
  error: { code?: string; message?: string } | null;
}

interface CanonicalQualityRepairResult {
  project_id: string;
  applied: boolean;
  rejected_reason?: string;
  changed_scene_ids: number[];
  after_quality: {
    passed: boolean;
    genre_score?: number;
    issue_count: number;
  };
  change_summary: {
    protected_fields_preserved?: string[];
  };
  operator_hints?: string[];
  detail?: {
    project: {
      current_version_id: string;
      version_count: number;
      updated_at: string;
    };
    versions: Array<{ version_id: string }>;
  };
}

function assertSafeProjectId(projectId: string): void {
  if (!projectId || projectId.includes('/') || projectId.includes('\\') || projectId.includes('..')) {
    throw new Error(`非法项目 ID：${projectId}`);
  }
}

function storyAgentBaseUrl(): string {
  const raw = process.env.STORY_AGENT_BASE_URL?.trim() || 'http://127.0.0.1:3000';
  const url = new URL(raw);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('STORY_AGENT_BASE_URL 仅支持 http/https');
  }
  return url.toString().replace(/\/$/, '');
}

async function readApiEnvelope(response: Response): Promise<ApiEnvelope<CanonicalQualityRepairResult>> {
  try {
    return await response.json() as ApiEnvelope<CanonicalQualityRepairResult>;
  } catch {
    throw new Error(`Story Agent application service 返回了非 JSON 响应（HTTP ${response.status}）`);
  }
}

/**
 * MCP is a client of the canonical Story Agent application service. It must
 * never write project.json or version snapshots directly.
 */
export async function updateProjectVersion(
  input: UpdateProjectVersionInput,
): Promise<UpdateProjectVersionResult | null> {
  const projectId = input.project_id.trim();
  assertSafeProjectId(projectId);
  if (input.change_type !== 'quality_repair') {
    throw new Error(
      'kb_update_project_version 当前仅支持 quality_repair；场景重生成和 Production Board 修复必须调用各自 canonical application endpoint。',
    );
  }
  try {
    const parsed = JSON.parse(input.snapshot_json);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('snapshot_json 必须是 JSON 对象');
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'snapshot_json 必须是 JSON 对象') throw error;
    throw new Error(`snapshot_json 不是有效 JSON：${error instanceof Error ? error.message : String(error)}`);
  }

  const applicationEndpoint = `${storyAgentBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/repair-quality/apply`;
  const response = await fetch(applicationEndpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      repaired_story_json: input.snapshot_json,
      user_instruction: input.user_instruction,
      apply: true,
      allow_no_improvement: false,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const envelope = await readApiEnvelope(response);
  if (!response.ok || !envelope.ok || !envelope.data) {
    if (envelope.error?.code === 'STORY_NOT_FOUND') return null;
    throw new Error(
      envelope.error?.message
        || `Story Agent application service 写入失败（HTTP ${response.status}）`,
    );
  }

  const applied = envelope.data;
  if (!applied.applied || !applied.detail) {
    throw new Error(applied.rejected_reason || 'canonical quality repair 未创建新版本');
  }
  const currentVersionId = applied.detail.project.current_version_id;
  const previousVersionId = applied.detail.versions
    .find(version => version.version_id !== currentVersionId)?.version_id ?? '';

  return {
    project_id: applied.project_id,
    previous_version_id: previousVersionId,
    version_id: currentVersionId,
    current_version_id: currentVersionId,
    version_count: applied.detail.project.version_count,
    updated_at: applied.detail.project.updated_at,
    change_type: 'quality_repair',
    scene_ids_changed: applied.changed_scene_ids,
    snapshot_path: 'managed-by-story-agent-application-service',
    project_path: 'managed-by-story-agent-application-service',
    preserved_fields: applied.change_summary.protected_fields_preserved ?? [],
    quality_summary: {
      quality_passed: applied.after_quality.passed,
      genre_score: applied.after_quality.genre_score,
      quality_issue_count: applied.after_quality.issue_count,
    },
    warnings: [
      ...(applied.operator_hints ?? []),
      '项目元数据与版本快照由 Story Agent application service 原子提交；MCP 未直接写文件。',
    ],
    canonical_service: true,
    application_endpoint: applicationEndpoint,
  };
}
