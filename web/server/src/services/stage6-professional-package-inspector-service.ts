import { createHash } from 'node:crypto';
import { ProfessionalTextPackageSchema, VideoTypeSchema } from '@shared/schemas.js';
import type {
  ProfessionalTextPackage,
  Stage6ProfessionalPackageInspectionIssue,
  Stage6ProfessionalPackageInspectionResult,
  Stage6ProfessionalPackageInspectorWorkspace,
  VideoType,
} from '@shared/types.js';
import { professionalPackageSha256 } from './professional-multi-round-revision-service.js';
import { createProfessionalTextPackageSkeleton } from './professional-text-package-service.js';

interface InspectionRequest {
  raw_json: string;
  expected_project_id: string;
  expected_video_type: VideoType | '';
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function issue(
  issues: Stage6ProfessionalPackageInspectionIssue[],
  value: Stage6ProfessionalPackageInspectionIssue,
): void {
  if (!issues.some(item => item.code === value.code && item.path === value.path)) issues.push(value);
}

function emptySummary(): Stage6ProfessionalPackageInspectionResult['package_summary'] {
  return {
    package_id: '',
    project_id: '',
    video_type: '',
    status: '',
    full_text_character_count: 0,
    sequence_beat_count: 0,
    scene_count: 0,
    delivery_scene_count: 0,
    evidence_item_count: 0,
    continuity_item_count: 0,
    revision_trace_count: 0,
    source_claimed_professional_passed: false,
  };
}

function rawProfessionalClaim(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const quality = (value as { quality_report?: unknown }).quality_report;
  return Boolean(quality && typeof quality === 'object'
    && (quality as { professional_passed?: unknown }).professional_passed === true);
}

function parseRequest(value: unknown): InspectionRequest | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.raw_json !== 'string'
    || typeof candidate.expected_project_id !== 'string'
    || typeof candidate.expected_video_type !== 'string') return null;
  const parsedVideoType = candidate.expected_video_type === ''
    ? ''
    : VideoTypeSchema.safeParse(candidate.expected_video_type).data;
  if (parsedVideoType === undefined) return null;
  return {
    raw_json: candidate.raw_json,
    expected_project_id: candidate.expected_project_id.trim(),
    expected_video_type: parsedVideoType,
  };
}

export function inspectStage6ProfessionalPackage(input: {
  request: unknown;
  now?: string;
}): Stage6ProfessionalPackageInspectionResult {
  const generatedAt = input.now ?? new Date().toISOString();
  const issues: Stage6ProfessionalPackageInspectionIssue[] = [];
  const request = parseRequest(input.request);
  const checks: Stage6ProfessionalPackageInspectionResult['checks'] = {
    request_valid: Boolean(request),
    json_valid: false,
    package_schema_valid: false,
    project_id_present: false,
    expected_project_binding_valid: false,
    expected_video_type_binding_valid: false,
    non_skeleton_status: false,
    full_text_present: false,
    sequence_beats_present: false,
    scene_breakdown_present: false,
    delivery_script_present: false,
    scene_ids_unique: false,
    delivery_scene_ids_bound: false,
  };
  if (!request) {
    issue(issues, {
      code: 'inspection_request_invalid', path: '', gate: 'request', blocking: true,
      message: 'raw_json, expected_project_id, and expected_video_type are required strings.',
    });
    return {
      schema_version: 'story-agent-stage6-professional-package-inspection/v1',
      generated_at: generatedAt,
      dry_run_only: true,
      input_persisted: false,
      p0_readiness_granted: false,
      execution_started: false,
      verified_real_revision_credit: false,
      professional_passed: false,
      source_file_sha256: '',
      canonical_package_sha256: '',
      schema_valid: false,
      p0_package_gate_passed: false,
      expected_binding: { project_id: '', video_type: '' },
      checks,
      package_summary: emptySummary(),
      issues,
    };
  }

  const sourceFileSha256 = sha256(request.raw_json);
  let rawPackage: unknown;
  try {
    rawPackage = JSON.parse(request.raw_json) as unknown;
    checks.json_valid = true;
  } catch (error) {
    issue(issues, {
      code: 'package_json_invalid', path: 'raw_json', gate: 'schema', blocking: true,
      message: (error as Error).message,
    });
  }
  const sourceClaimedProfessionalPass = rawProfessionalClaim(rawPackage);
  if (sourceClaimedProfessionalPass) {
    issue(issues, {
      code: 'self_reported_professional_pass_excluded', path: 'quality_report.professional_passed', gate: 'credit', blocking: false,
      message: 'A package cannot grant its own professional-pass credit; signed external review remains required.',
    });
  }
  const parsed = ProfessionalTextPackageSchema.safeParse(rawPackage);
  if (!parsed.success) {
    for (const item of parsed.error.issues.slice(0, 50)) {
      issue(issues, {
        code: 'package_schema_invalid', path: item.path.join('.'), gate: 'schema', blocking: true, message: item.message,
      });
    }
  }
  const pkg = parsed.success ? parsed.data : null;
  checks.package_schema_valid = Boolean(pkg);
  const summary = pkg ? {
    package_id: pkg.package_id,
    project_id: pkg.project_id ?? '',
    video_type: pkg.video_type,
    status: pkg.status,
    full_text_character_count: pkg.full_text.length,
    sequence_beat_count: pkg.sequence_beats.length,
    scene_count: pkg.scene_breakdown.length,
    delivery_scene_count: pkg.delivery_text_package.scene_units.length,
    evidence_item_count: pkg.research_and_evidence_dossier.evidence_items.length,
    continuity_item_count: pkg.continuity_ledger.items.length,
    revision_trace_count: pkg.revision_trace.length,
    ...(pkg.quality_report.total_score === undefined ? {} : { quality_total_score: pkg.quality_report.total_score }),
    source_claimed_professional_passed: sourceClaimedProfessionalPass,
  } satisfies Stage6ProfessionalPackageInspectionResult['package_summary'] : {
    ...emptySummary(),
    source_claimed_professional_passed: sourceClaimedProfessionalPass,
  };

  if (pkg) {
    checks.project_id_present = Boolean(pkg.project_id?.trim());
    checks.expected_project_binding_valid = Boolean(request.expected_project_id
      && pkg.project_id === request.expected_project_id);
    checks.expected_video_type_binding_valid = Boolean(request.expected_video_type
      && pkg.video_type === request.expected_video_type);
    checks.non_skeleton_status = pkg.status !== 'skeleton';
    checks.full_text_present = Boolean(pkg.full_text.trim());
    checks.sequence_beats_present = pkg.sequence_beats.length > 0;
    checks.scene_breakdown_present = pkg.scene_breakdown.length > 0;
    checks.delivery_script_present = Boolean(pkg.delivery_text_package.script_text.trim());
    const sceneIds = pkg.scene_breakdown.map(scene => scene.scene_id);
    checks.scene_ids_unique = new Set(sceneIds).size === sceneIds.length;
    const sceneIdSet = new Set(sceneIds);
    checks.delivery_scene_ids_bound = pkg.delivery_text_package.scene_units.every(unit => sceneIdSet.has(unit.scene_id));
    const gateChecks: Array<[keyof typeof checks, string, string, Stage6ProfessionalPackageInspectionIssue['gate']]> = [
      ['project_id_present', 'package_project_id_missing', 'project_id', 'binding'],
      ['expected_project_binding_valid', 'package_project_binding_mismatch', 'project_id', 'binding'],
      ['expected_video_type_binding_valid', 'package_video_type_binding_mismatch', 'video_type', 'binding'],
      ['non_skeleton_status', 'initial_package_skeleton_not_revisionable', 'status', 'revisionable'],
      ['full_text_present', 'initial_package_full_text_missing', 'full_text', 'revisionable'],
      ['sequence_beats_present', 'initial_package_sequence_beats_missing', 'sequence_beats', 'revisionable'],
      ['scene_breakdown_present', 'initial_package_scenes_missing', 'scene_breakdown', 'revisionable'],
      ['delivery_script_present', 'initial_package_delivery_script_missing', 'delivery_text_package.script_text', 'revisionable'],
    ];
    for (const [key, code, path, gate] of gateChecks) {
      if (!checks[key]) issue(issues, { code, path, gate, blocking: true, message: `${path} does not satisfy the P0 initial-package gate.` });
    }
    if (!checks.scene_ids_unique) issue(issues, {
      code: 'scene_ids_not_unique', path: 'scene_breakdown', gate: 'consistency', blocking: false,
      message: 'Scene IDs should be unique for deterministic diff and delivery binding.',
    });
    if (!checks.delivery_scene_ids_bound) issue(issues, {
      code: 'delivery_scene_id_unbound', path: 'delivery_text_package.scene_units', gate: 'consistency', blocking: false,
      message: 'Every delivery scene unit should reference an existing scene_breakdown scene_id.',
    });
  }
  const p0PackageGatePassed = checks.package_schema_valid
    && checks.project_id_present
    && checks.expected_project_binding_valid
    && checks.expected_video_type_binding_valid
    && checks.non_skeleton_status
    && checks.full_text_present
    && checks.sequence_beats_present
    && checks.scene_breakdown_present
    && checks.delivery_script_present;
  return {
    schema_version: 'story-agent-stage6-professional-package-inspection/v1',
    generated_at: generatedAt,
    dry_run_only: true,
    input_persisted: false,
    p0_readiness_granted: false,
    execution_started: false,
    verified_real_revision_credit: false,
    professional_passed: false,
    source_file_sha256: sourceFileSha256,
    canonical_package_sha256: pkg ? professionalPackageSha256(pkg) : '',
    schema_valid: checks.package_schema_valid,
    p0_package_gate_passed: p0PackageGatePassed,
    expected_binding: { project_id: request.expected_project_id, video_type: request.expected_video_type },
    checks,
    package_summary: summary,
    issues,
  };
}

export function getStage6ProfessionalPackageInspectorWorkspace(input: {
  videoType?: unknown;
  now?: string;
}): Stage6ProfessionalPackageInspectorWorkspace {
  const videoType = VideoTypeSchema.safeParse(input.videoType).data ?? 'character_story';
  const now = input.now ?? new Date().toISOString();
  const template = createProfessionalTextPackageSkeleton({ video_type: videoType, now });
  return {
    schema_version: 'story-agent-stage6-professional-package-inspector-workspace/v1',
    generated_at: now,
    policy: {
      dry_run_only: true,
      input_files_are_not_persisted: true,
      p0_readiness_can_be_granted: false,
      canonical_hash_is_p0_source_file_hash: false,
      self_reported_professional_pass_is_credit: false,
    },
    selected_video_type: videoType,
    template,
    template_inspection: inspectStage6ProfessionalPackage({
      request: { raw_json: `${JSON.stringify(template, null, 2)}\n`, expected_project_id: '', expected_video_type: videoType },
      now,
    }),
  };
}
