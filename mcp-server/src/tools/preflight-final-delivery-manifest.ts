import fs from 'node:fs/promises';
import path from 'node:path';
import { getKbRoot } from '../lib/provinces.js';

type JsonRecord = Record<string, unknown>;

export type FinalDeliveryManifestDisposition =
  | 'preserve_fixture_exclude_from_publishable_delivery'
  | 'reexport_after_authorized_dependencies';

export interface PreflightStoryAgentFinalDeliveryManifestInput {
  series_project_id: string;
  disposition: FinalDeliveryManifestDisposition;
  authorized_media_inputs_attested?: boolean;
}

export type FinalDeliveryManifestPreflightCheckKey =
  | 'target_exists'
  | 'manifest_gap_confirmed'
  | 'authorized_media_inputs'
  | 'cut_output'
  | 'subtitle_output'
  | 'audio_mix_output'
  | 'title_card_outputs'
  | 'project_scoped_paths';

export interface FinalDeliveryManifestPreflightCheck {
  key: FinalDeliveryManifestPreflightCheckKey;
  status: 'passed' | 'failed' | 'not_applicable';
  required: boolean;
  evidence: string[];
  missing_paths?: string[];
  unsafe_paths?: string[];
}

export interface StoryAgentFinalDeliveryManifestPreflightResult {
  schema_version: 'story-agent-final-delivery-manifest-preflight/v1';
  generated_at: string;
  series_project_id: string;
  disposition: FinalDeliveryManifestDisposition;
  status: 'ready' | 'blocked';
  eligible_for_selected_disposition: boolean;
  operator_review_required: true;
  publishable_delivery_credit_granted: false;
  generated_files_modified: false;
  final_assemble_invoked: false;
  manifest_written: false;
  project_json_written: false;
  checks: FinalDeliveryManifestPreflightCheck[];
  missing_dependencies: string[];
  unsafe_paths: string[];
  recommended_action: string;
  notes: string[];
  markdown: string;
}

interface InspectedPath {
  label: string;
  declared_path?: string;
  safe: boolean;
  exists: boolean;
  reason?: string;
}

function generatedRoot(): string {
  return process.env.WEB_GENERATED_ROOT || path.resolve(getKbRoot(), '..', 'web', 'generated');
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(asString).filter((item): item is string => Boolean(item)) : [];
}

function projectIdIsSafe(projectId: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(projectId) && projectId !== '.' && projectId !== '..';
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    return (await fs.stat(filePath)).isFile();
  } catch {
    return false;
  }
}

async function inspectGeneratedPath(
  root: string,
  projectId: string,
  label: string,
  declaredPath: string | undefined,
): Promise<InspectedPath> {
  if (!declaredPath) return { label, safe: false, exists: false, reason: 'path_not_declared' };
  if (path.isAbsolute(declaredPath) || /^[a-z][a-z0-9+.-]*:\/\//i.test(declaredPath)) {
    return { label, declared_path: declaredPath, safe: false, exists: false, reason: 'absolute_or_url_path' };
  }
  const resolvedPath = path.resolve(root, declaredPath);
  const relation = path.relative(root, resolvedPath);
  const insideRoot = relation !== ''
    && relation !== '..'
    && !relation.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relation);
  const projectScoped = declaredPath.split(/[\\/]+/).includes(projectId);
  if (!insideRoot || !projectScoped) {
    return {
      label,
      declared_path: declaredPath,
      safe: false,
      exists: false,
      reason: insideRoot ? 'path_not_project_scoped' : 'path_escapes_generated_root',
    };
  }
  return {
    label,
    declared_path: declaredPath,
    safe: true,
    exists: await fileExists(resolvedPath),
  };
}

function notApplicableCheck(
  key: FinalDeliveryManifestPreflightCheckKey,
  reason: string,
): FinalDeliveryManifestPreflightCheck {
  return { key, status: 'not_applicable', required: false, evidence: [reason] };
}

function renderMarkdown(result: Omit<StoryAgentFinalDeliveryManifestPreflightResult, 'markdown'>): string {
  return [
    '# MCP Story Agent Final Delivery Manifest Preflight',
    '',
    `> generated_at: ${result.generated_at}`,
    `> series_project_id: ${result.series_project_id}`,
    `> disposition: ${result.disposition}`,
    `> status: ${result.status}`,
    `> eligible_for_selected_disposition: ${result.eligible_for_selected_disposition}`,
    `> publishable_delivery_credit_granted: ${result.publishable_delivery_credit_granted}`,
    '',
    '## Checks',
    '',
    ...result.checks.map(check => `- ${check.key}: ${check.status}${check.evidence.length ? ` · ${check.evidence.join('; ')}` : ''}`),
    '',
    '## Recommended action',
    '',
    `- ${result.recommended_action}`,
    '',
    '## Notes',
    '',
    ...result.notes.map(note => `- ${note}`),
  ].join('\n').trim() + '\n';
}

export async function preflightStoryAgentFinalDeliveryManifest(
  input: PreflightStoryAgentFinalDeliveryManifestInput,
): Promise<StoryAgentFinalDeliveryManifestPreflightResult> {
  const generatedAt = new Date().toISOString();
  const root = generatedRoot();
  const projectId = input.series_project_id.trim();
  const projectRoot = path.resolve(root, 'ai-comic-series-projects');
  const projectDir = path.resolve(projectRoot, projectId);
  const safeProjectId = projectIdIsSafe(projectId) && path.relative(projectRoot, projectDir) === projectId;
  let projectRecord: JsonRecord | undefined;
  if (safeProjectId) {
    try {
      projectRecord = asRecord(JSON.parse(await fs.readFile(path.resolve(projectDir, 'project.json'), 'utf8')));
    } catch {
      projectRecord = undefined;
    }
  }
  const recordedProjectId = asString(asRecord(projectRecord?.project).series_project_id)
    ?? asString(projectRecord?.series_project_id);
  const targetExists = Boolean(projectRecord) && (!recordedProjectId || recordedProjectId === projectId);
  const finalDelivery = asRecord(projectRecord?.seedance_final_delivery);
  const finalStatus = asString(finalDelivery.status);
  const manifestGapConfirmed = targetExists
    && (finalStatus === 'ready' || finalStatus === 'planned')
    && Boolean(asString(finalDelivery.output_path))
    && !asString(finalDelivery.manifest_path);
  const checks: FinalDeliveryManifestPreflightCheck[] = [
    {
      key: 'target_exists',
      status: targetExists ? 'passed' : 'failed',
      required: true,
      evidence: targetExists
        ? [`project.json found for ${projectId}`]
        : [safeProjectId ? 'project.json missing or unreadable' : 'series_project_id is not a safe directory identifier'],
    },
    {
      key: 'manifest_gap_confirmed',
      status: manifestGapConfirmed ? 'passed' : 'failed',
      required: true,
      evidence: manifestGapConfirmed
        ? [`final delivery ${finalStatus} output is declared and manifest_path is absent`]
        : [targetExists ? 'target is not a current final-delivery manifest gap' : 'target must exist before gap classification'],
    },
  ];
  const missingDependencies: string[] = [];
  const unsafePaths: string[] = [];

  if (input.disposition === 'preserve_fixture_exclude_from_publishable_delivery') {
    checks.push(
      notApplicableCheck('authorized_media_inputs', 'fixture preservation does not authorize media execution'),
      notApplicableCheck('cut_output', 'fixture preservation does not require re-export dependencies'),
      notApplicableCheck('subtitle_output', 'fixture preservation does not require re-export dependencies'),
      notApplicableCheck('audio_mix_output', 'fixture preservation does not require re-export dependencies'),
      notApplicableCheck('title_card_outputs', 'fixture preservation does not require re-export dependencies'),
      notApplicableCheck('project_scoped_paths', 'fixture preservation performs no delivery writes'),
    );
  } else if (!targetExists || !manifestGapConfirmed) {
    checks.push(
      notApplicableCheck('authorized_media_inputs', 'target validation failed'),
      notApplicableCheck('cut_output', 'target validation failed'),
      notApplicableCheck('subtitle_output', 'target validation failed'),
      notApplicableCheck('audio_mix_output', 'target validation failed'),
      notApplicableCheck('title_card_outputs', 'target validation failed'),
      notApplicableCheck('project_scoped_paths', 'target validation failed'),
    );
  } else {
    const cut = asRecord(projectRecord?.seedance_cut_assembly);
    const subtitle = asRecord(projectRecord?.seedance_subtitle_render);
    const audio = asRecord(projectRecord?.seedance_audio_mix);
    const titleCards = asRecord(projectRecord?.seedance_title_card_render);
    const placeholderMediaReference = /https?:\/\/example\.com|<[^>]+>/.test(JSON.stringify({
      production: projectRecord?.seedance_production,
      audio_library: projectRecord?.seedance_audio_library,
      audio_mix: audio,
      title_cards: titleCards,
    }));
    const authorized = input.authorized_media_inputs_attested === true && !placeholderMediaReference;
    checks.push({
      key: 'authorized_media_inputs',
      status: authorized ? 'passed' : 'failed',
      required: true,
      evidence: [
        `operator_attestation=${input.authorized_media_inputs_attested === true}`,
        `placeholder_media_reference_detected=${placeholderMediaReference}`,
      ],
    });
    if (!authorized) missingDependencies.push('authorized_media_inputs');

    const dependencySpecs = [
      {
        key: 'cut_output' as const,
        ledger: cut,
        paths: [['cut_output', asString(cut.output_path)]] as Array<[string, string | undefined]>,
        countersReady: (asNumber(cut.missing_shot_count) ?? 0) === 0,
        counterEvidence: `missing_shot_count=${asNumber(cut.missing_shot_count) ?? 'unknown'}`,
      },
      {
        key: 'subtitle_output' as const,
        ledger: subtitle,
        paths: [
          ['subtitle_output', asString(subtitle.output_path)],
          ['subtitle_srt', asString(subtitle.srt_path)],
        ] as Array<[string, string | undefined]>,
        countersReady: true,
        counterEvidence: `cue_count=${asNumber(subtitle.cue_count) ?? 'unknown'}`,
      },
      {
        key: 'audio_mix_output' as const,
        ledger: audio,
        paths: [['audio_mix_output', asString(audio.output_path)]] as Array<[string, string | undefined]>,
        countersReady: (asNumber(audio.missing_audio_count) ?? 0) === 0,
        counterEvidence: `missing_audio_count=${asNumber(audio.missing_audio_count) ?? 'unknown'}`,
      },
      {
        key: 'title_card_outputs' as const,
        ledger: titleCards,
        paths: asStringArray(titleCards.output_paths).map((item, index) => [`title_card_${index + 1}`, item] as [string, string]),
        countersReady: (asNumber(titleCards.card_count) ?? 0) > 0
          && asNumber(titleCards.rendered_count) === asNumber(titleCards.card_count),
        counterEvidence: `rendered_count=${asNumber(titleCards.rendered_count) ?? 'unknown'}/${asNumber(titleCards.card_count) ?? 'unknown'}`,
      },
    ];
    const inspectedDependencyPaths: InspectedPath[] = [];
    for (const spec of dependencySpecs) {
      const inspected = await Promise.all(spec.paths.map(([label, declaredPath]) =>
        inspectGeneratedPath(root, projectId, label, declaredPath)));
      inspectedDependencyPaths.push(...inspected);
      const ledgerReady = asString(spec.ledger.status) === 'ready' && spec.ledger.dry_run !== true;
      const missingPaths = inspected.filter(item => item.safe && !item.exists).map(item => item.declared_path!);
      const dependencyUnsafePaths = inspected.filter(item => !item.safe).map(item => item.declared_path ?? `<${item.label}:undeclared>`);
      const passed = ledgerReady
        && spec.paths.length > 0
        && spec.countersReady
        && missingPaths.length === 0
        && dependencyUnsafePaths.length === 0;
      checks.push({
        key: spec.key,
        status: passed ? 'passed' : 'failed',
        required: true,
        evidence: [
          `ledger_status=${asString(spec.ledger.status) ?? 'missing'}`,
          `dry_run=${spec.ledger.dry_run === true}`,
          spec.counterEvidence,
          `declared_path_count=${spec.paths.length}`,
          `existing_file_count=${inspected.filter(item => item.exists).length}`,
        ],
        ...(missingPaths.length ? { missing_paths: missingPaths } : {}),
        ...(dependencyUnsafePaths.length ? { unsafe_paths: dependencyUnsafePaths } : {}),
      });
      if (!passed) missingDependencies.push(spec.key);
    }

    const prospectiveManifestPath = asString(finalDelivery.manifest_path)
      ?? `delivery/${projectId}/${projectId}-seedance-final.manifest.json`;
    const inspectedProjectPaths = await Promise.all([
      ...inspectedDependencyPaths.map(item => inspectGeneratedPath(root, projectId, item.label, item.declared_path)),
      inspectGeneratedPath(root, projectId, 'final_delivery_output', asString(finalDelivery.output_path)),
      inspectGeneratedPath(root, projectId, 'prospective_manifest', prospectiveManifestPath),
    ]);
    unsafePaths.push(...new Set(inspectedProjectPaths
      .filter(item => !item.safe)
      .map(item => item.declared_path ?? `<${item.label}:undeclared>`)));
    checks.push({
      key: 'project_scoped_paths',
      status: unsafePaths.length === 0 ? 'passed' : 'failed',
      required: true,
      evidence: [
        `inspected_path_count=${inspectedProjectPaths.length}`,
        `unsafe_path_count=${unsafePaths.length}`,
        `prospective_manifest_path=${prospectiveManifestPath}`,
      ],
      ...(unsafePaths.length ? { unsafe_paths: unsafePaths } : {}),
    });
    if (unsafePaths.length) missingDependencies.push('project_scoped_paths');
  }

  const eligible = checks.filter(check => check.required).every(check => check.status === 'passed');
  const result: Omit<StoryAgentFinalDeliveryManifestPreflightResult, 'markdown'> = {
    schema_version: 'story-agent-final-delivery-manifest-preflight/v1',
    generated_at: generatedAt,
    series_project_id: projectId,
    disposition: input.disposition,
    status: eligible ? 'ready' : 'blocked',
    eligible_for_selected_disposition: eligible,
    operator_review_required: true,
    publishable_delivery_credit_granted: false,
    generated_files_modified: false,
    final_assemble_invoked: false,
    manifest_written: false,
    project_json_written: false,
    checks,
    missing_dependencies: [...new Set(missingDependencies)],
    unsafe_paths: [...new Set(unsafePaths)],
    recommended_action: input.disposition === 'preserve_fixture_exclude_from_publishable_delivery'
      ? (eligible
        ? 'Record an operator-approved signoff exclusion; preserve the fixture without publishable-delivery credit.'
        : 'Do not record an exclusion until the exact manifest-gap target is identified.')
      : (eligible
        ? 'Dependencies are structurally eligible for a separately authorized GEARS re-export; this preflight did not execute it.'
        : 'Keep re-export blocked; repair or authorize every failed dependency and rerun this read-only preflight.'),
    notes: [
      'This preflight is read-only and never calls final assembly or writes project.json/manifest files.',
      'Historical dependency_status booleans are not trusted without current ledger, path, and file evidence.',
      'Passing preflight never grants publishable-delivery or real-execution credit; media execution remains in GEARS v2.',
    ],
  };
  return { ...result, markdown: renderMarkdown(result) };
}
