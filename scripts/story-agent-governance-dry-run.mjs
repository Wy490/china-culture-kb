import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const writeMode = process.argv.includes('--write');
const checkMode = process.argv.includes('--check');
const validatedMode = process.argv.includes('--validated');
const applySignoffExclusionMode = process.argv.includes('--apply-signoff-exclusion');
const generatedAt = new Date().toISOString();

const paths = {
  queue: 'data/reports/story-agent-monitor-remediation-queue-20260710.json',
  callbackHandoff: 'data/reports/story-agent-governance-external-callback-baseline-20260710.json',
  checkpoint: 'data/reports/story-agent-version-checkpoint-20260710.json',
  archiveManifest: 'data/reports/story-agent-soft-archive-manifest-20260710.json',
  relinkTriage: 'data/reports/story-agent-relink-triage-20260710.json',
  report: 'docs/story-agent-governance-dry-run-20260710.md',
};

async function readJson(relativePath) {
  return JSON.parse(await fs.readFile(path.join(repoRoot, relativePath), 'utf8'));
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function fileEvidence(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  try {
    const [contents, stat] = await Promise.all([fs.readFile(absolutePath), fs.stat(absolutePath)]);
    return {
      path: relativePath,
      exists: true,
      size_bytes: stat.size,
      sha256: sha256(contents),
    };
  } catch {
    return {
      path: relativePath,
      exists: false,
      size_bytes: 0,
      sha256: null,
    };
  }
}

function classifyWorkspacePath(relativePath) {
  if (relativePath.startsWith('data/production-cards/')) return 'production_cards';
  if (relativePath.startsWith('docs/production-cards/')) return 'production_card_docs';
  if (relativePath.startsWith('data/reports/story-agent-')) return 'story_agent_reports';
  if (relativePath.startsWith('data/professional-benchmarks/')) return 'professional_benchmarks';
  if (relativePath.startsWith('docs/story-agent-')) return 'story_agent_docs';
  if (relativePath.startsWith('mcp-server/__tests__/')) return 'mcp_tests';
  if (relativePath.startsWith('mcp-server/src/')) return 'mcp_implementation';
  if (relativePath.startsWith('web/server/src/__tests__/')) return 'web_server_tests';
  if (relativePath.startsWith('web/server/src/')) return 'web_server_implementation';
  if (relativePath.startsWith('web/server/scripts/')) return 'web_server_scripts';
  if (relativePath.startsWith('web/shared/')) return 'shared_contracts';
  if (relativePath.startsWith('scripts/')) return 'scripts';
  if (relativePath.startsWith('data/domain-packs/')) return 'domain_pack_candidates';
  return 'other';
}

function parseGitStatus() {
  const raw = execFileSync('git', [
    'status',
    '--porcelain=v1',
    '-z',
    '--untracked-files=all',
  ], { cwd: repoRoot, encoding: 'utf8' });
  const tokens = raw.split('\0').filter(Boolean);
  const rows = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const status = token.slice(0, 2);
    const relativePath = token.slice(3);
    const row = { status, path: relativePath };
    if (status.includes('R') || status.includes('C')) {
      row.original_path = tokens[index + 1];
      index += 1;
    }
    rows.push(row);
  }
  return rows;
}

async function buildVersionCheckpoint() {
  const statusRows = parseGitStatus().filter(row => row.path !== paths.checkpoint);
  const files = await Promise.all(statusRows.map(async row => ({
    ...row,
    tracked: row.status !== '??',
    category: classifyWorkspacePath(row.path),
    ...await fileEvidence(row.path),
  })));
  const byCategory = Object.fromEntries(
    [...new Set(files.map(item => item.category))]
      .sort()
      .map(category => [category, files.filter(item => item.category === category).length]),
  );
  const checkpointId = sha256(files
    .map(item => `${item.status}\t${item.path}\t${item.sha256 ?? 'missing'}`)
    .sort()
    .join('\n'));
  return {
    schema_version: 'story-agent-version-checkpoint/v1',
    generated_at: generatedAt,
    checkpoint_id: checkpointId,
    scope: 'pre-governance workspace checkpoint; preserves user changes and excludes its own self-referential file',
    mutation_policy: {
      stages_files: false,
      commits_files: false,
      modifies_generated_projects: false,
      deletes_files: false,
    },
    summary: {
      changed_file_count: files.length,
      tracked_modified_file_count: files.filter(item => item.tracked).length,
      untracked_file_count: files.filter(item => !item.tracked).length,
      missing_file_count: files.filter(item => !item.exists).length,
      by_category: byCategory,
    },
    excluded_paths: [paths.checkpoint],
    files,
  };
}

async function buildArchiveManifest(queue) {
  const entries = await Promise.all(queue.archive_or_rebuild_candidates.map(async candidate => {
    const projectPath = `web/generated/ai-comic-series-projects/${candidate.project_id}/project.json`;
    return {
      project_id: candidate.project_id,
      title: candidate.title,
      project_file: await fileEvidence(projectPath),
      missing_story_ids: candidate.missing_story_ids,
      contract_evidence: candidate.contract_evidence,
      production_item_count: candidate.production_item_count,
      current_queue_action: candidate.action,
      disposition: 'soft_archive_exclude_from_gears_signoff',
      execution_status: applySignoffExclusionMode ? 'signoff_exclusion_active' : 'dry_run_not_applied',
      rebuild_policy: 'curated_whitelist_only',
      recovery_policy: 'preserve_original_project_file_and_manifest_evidence',
      requires_operator_review: true,
    };
  }));
  return {
    schema_version: 'story-agent-soft-archive-manifest/v1',
    generated_at: generatedAt,
    source_queue: paths.queue,
    source_queue_sha256: (await fileEvidence(paths.queue)).sha256,
    mode: applySignoffExclusionMode ? 'active_signoff_exclusion' : 'dry_run',
    policy: {
      destructive_delete_allowed: false,
      project_json_mutation_allowed: false,
      signoff_exclusion_applied: applySignoffExclusionMode,
      rebuild_requires_whitelist: true,
      archive_is_reversible: true,
    },
    summary: {
      candidate_count: entries.length,
      project_file_present_count: entries.filter(item => item.project_file.exists).length,
      project_file_missing_count: entries.filter(item => !item.project_file.exists).length,
      applied_count: applySignoffExclusionMode ? entries.length : 0,
      rebuild_whitelist_count: 0,
      deletion_count: 0,
    },
    entries,
  };
}

function relinkReviewRoute(candidate) {
  if ((candidate.potential_suffix_matches?.length ?? 0) > 0) {
    return 'manual_suffix_evidence_review';
  }
  if (candidate.test_fixture_failure_item_count > 0 && candidate.unmarked_failure_item_count === 0) {
    return 'external_backup_or_fixture_reclassification_review';
  }
  return 'external_backup_required';
}

function buildRelinkTriage(queue) {
  const entries = queue.relink_candidates.map(candidate => ({
    project_id: candidate.project_id,
    title: candidate.title,
    missing_story_ids: candidate.missing_story_ids,
    contract_evidence: candidate.contract_evidence,
    ready_production_item_count: candidate.ready_production_item_count,
    failed_production_item_count: candidate.failed_production_item_count,
    test_fixture_failure_item_count: candidate.test_fixture_failure_item_count,
    unmarked_failure_item_count: candidate.unmarked_failure_item_count,
    potential_suffix_matches: candidate.potential_suffix_matches,
    auto_recovery_safe: false,
    review_route: relinkReviewRoute(candidate),
    execution_status: 'operator_evidence_required',
    acceptable_outcomes: [
      'exact_story_backup_restored',
      'confirmed_fixture_or_regression_reclassified',
      'isolated_pending_evidence',
    ],
    required_match_evidence: [
      'exact_story_id_or_verified_version_mapping',
      'episode_identity',
      'full_text_or_scene_identity',
      'continuity_and_production_ledger_consistency',
    ],
    guessed_relink_allowed: false,
  }));
  const routeCounts = Object.fromEntries(
    [...new Set(entries.map(item => item.review_route))]
      .sort()
      .map(route => [route, entries.filter(item => item.review_route === route).length]),
  );
  return {
    schema_version: 'story-agent-relink-triage/v1',
    generated_at: generatedAt,
    source_queue: paths.queue,
    mode: 'evidence_triage_only',
    policy: {
      exact_backup_preferred: true,
      suffix_only_match_allowed: false,
      bulk_relink_allowed: false,
      fixture_reclassification_requires_operator_confirmation: true,
    },
    summary: {
      candidate_count: entries.length,
      safe_auto_relink_count: entries.filter(item => item.auto_recovery_safe).length,
      suffix_hint_manual_review_count: entries.filter(item => item.potential_suffix_matches.length > 0).length,
      guessed_relink_count: 0,
      resolved_count: 0,
      by_review_route: routeCounts,
    },
    entries,
  };
}

function renderReport({ checkpoint, archiveManifest, relinkTriage, handoff }) {
  const categories = Object.entries(checkpoint.summary.by_category)
    .map(([category, count]) => `- ${category}: ${count}`)
    .join('\n');
  const routes = Object.entries(relinkTriage.summary.by_review_route)
    .map(([route, count]) => `- ${route}: ${count}`)
    .join('\n');
  const archiveState = archiveManifest.policy.signoff_exclusion_applied
    ? 'active_signoff_exclusion'
    : 'checkpoint_and_dry_run_manifests_ready';
  return `# Story Agent 历史治理 dry-run 报告

> generated_at: ${generatedAt}
> 状态：${archiveState}

## B0 版本检查点

- checkpoint_id: \`${checkpoint.checkpoint_id}\`
- 变更文件：${checkpoint.summary.changed_file_count}
- tracked 修改：${checkpoint.summary.tracked_modified_file_count}
- untracked：${checkpoint.summary.untracked_file_count}
- 缺失文件：${checkpoint.summary.missing_file_count}
- 未执行 stage、commit、generated 项目改写或删除。

分类：

${categories}

## B1：827 项软归档 dry-run

- 候选：${archiveManifest.summary.candidate_count}
- 项目文件存在：${archiveManifest.summary.project_file_present_count}
- 缺失：${archiveManifest.summary.project_file_missing_count}
- 已应用归档：${archiveManifest.summary.applied_count}
- 删除：${archiveManifest.summary.deletion_count}
- ${archiveManifest.policy.signoff_exclusion_applied
    ? '可逆 manifest 已激活为 GEARS signoff 排除源；没有改写项目 JSON。'
    : '当前只生成可逆 manifest；尚未接入 GEARS signoff 排除。'}

## B2：99 项证据分流

- 候选：${relinkTriage.summary.candidate_count}
- 安全自动恢复：${relinkTriage.summary.safe_auto_relink_count}
- 后缀人工线索：${relinkTriage.summary.suffix_hint_manual_review_count}
- 猜测性 relink：${relinkTriage.summary.guessed_relink_count}

分流：

${routes}

## B3：目标项目外部回片

- 项目：\`${handoff.project.project_id}\`
- total_job_count=${handoff.total_job_count}
- external_ready=${handoff.external_ready_count}
- local_acceptance_ready=${handoff.local_acceptance_ready_count}
- pending_external_artifact=${handoff.pending_external_artifact_count}
- 没有真实公共 URL 时保持 \`needs_action\`，不导入占位链接。

## 下一步

1. 用契约测试冻结三个机器产物。
2. 评估以 manifest 为输入的可逆 signoff 排除接入，不修改 827 个项目 JSON。
3. 99 项等待准确备份或人工用途确认；不自动补链。
4. 专业文本轨道保持 Stage 2 / Iteration 3：受控执行合同已就绪，等待独立 operator 授权、真实模型结果与真人盲评。
`;
}

function validateOutputs({ checkpoint, archiveManifest, relinkTriage, handoff }) {
  if (archiveManifest.entries.length !== 827) throw new Error('Expected 827 archive candidates');
  if (new Set(archiveManifest.entries.map(item => item.project_id)).size !== 827) {
    throw new Error('Archive manifest contains duplicate project ids');
  }
  if (archiveManifest.policy.destructive_delete_allowed || archiveManifest.summary.deletion_count !== 0) {
    throw new Error('Dry-run archive manifest must never delete projects');
  }
  const expectedArchiveEntryStatus = archiveManifest.policy.signoff_exclusion_applied
    ? 'signoff_exclusion_active'
    : 'dry_run_not_applied';
  if (archiveManifest.entries.some(item => item.execution_status !== expectedArchiveEntryStatus)) {
    throw new Error('Archive entry execution status does not match manifest mode');
  }
  if (relinkTriage.entries.length !== 99) throw new Error('Expected 99 relink candidates');
  if (new Set(relinkTriage.entries.map(item => item.project_id)).size !== 99) {
    throw new Error('Relink triage contains duplicate project ids');
  }
  if (relinkTriage.summary.safe_auto_relink_count !== 0 || relinkTriage.summary.guessed_relink_count !== 0) {
    throw new Error('Unsafe relink evidence was promoted');
  }
  if (handoff.schema_version !== 'story-agent-governance-external-callback-baseline/v1') {
    throw new Error('Target project external artifact baseline schema drifted');
  }
  if (
    handoff.source_artifact?.schema_version !== 'project-gears-external-callback-handoff/v1'
    || !/^[a-f0-9]{64}$/.test(handoff.source_artifact?.sha256 ?? '')
    || handoff.source_artifact?.repository_tracked !== false
  ) {
    throw new Error('Target project external artifact baseline provenance is invalid');
  }
  if (
    handoff.total_job_count !== 5
    || handoff.pending_external_artifact_count !== 5
    || handoff.external_ready_count !== 0
    || handoff.local_acceptance_ready_count !== 5
    || handoff.real_external_artifact_verified !== false
    || handoff.production_credit_granted !== false
  ) {
    throw new Error('Target project external artifact baseline drifted');
  }
  if (checkpoint.excluded_paths.includes(paths.checkpoint) === false) {
    throw new Error('Version checkpoint must exclude its self-referential output');
  }
}

async function writeJson(relativePath, value) {
  await fs.writeFile(path.join(repoRoot, relativePath), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function checkWrittenOutputs() {
  const [checkpoint, archiveManifest, relinkTriage, handoff] = await Promise.all([
    readJson(paths.checkpoint),
    readJson(paths.archiveManifest),
    readJson(paths.relinkTriage),
    readJson(paths.callbackHandoff),
  ]);
  validateOutputs({ checkpoint, archiveManifest, relinkTriage, handoff });
  console.log('Story Agent governance checkpoint and dry-run manifests passed contract checks.');
}

async function main() {
  if (checkMode) {
    await checkWrittenOutputs();
    return;
  }
  const [queue, handoff] = await Promise.all([readJson(paths.queue), readJson(paths.callbackHandoff)]);
  const archiveManifest = await buildArchiveManifest(queue);
  const relinkTriage = buildRelinkTriage(queue);

  if (writeMode) {
    await Promise.all([
      writeJson(paths.archiveManifest, archiveManifest),
      writeJson(paths.relinkTriage, relinkTriage),
    ]);
  }

  let checkpoint = await buildVersionCheckpoint();
  const report = renderReport({ checkpoint, archiveManifest, relinkTriage, handoff });
  if (writeMode) {
    await fs.writeFile(path.join(repoRoot, paths.report), report, 'utf8');
    checkpoint = await buildVersionCheckpoint();
    checkpoint.validation = {
      status: validatedMode ? 'passed' : 'not_recorded',
      commands: [
        'node scripts/story-agent-governance-dry-run.mjs --check',
        'npx vitest run __tests__/story-agent-governance-dry-run.test.ts',
        'git diff --check',
      ],
    };
    await writeJson(paths.checkpoint, checkpoint);
  }

  validateOutputs({ checkpoint, archiveManifest, relinkTriage, handoff });
  console.log(JSON.stringify({
    written: writeMode,
    checkpoint_id: checkpoint.checkpoint_id,
    changed_file_count: checkpoint.summary.changed_file_count,
    archive_candidate_count: archiveManifest.summary.candidate_count,
    archive_applied_count: archiveManifest.summary.applied_count,
    signoff_exclusion_applied: archiveManifest.policy.signoff_exclusion_applied,
    relink_candidate_count: relinkTriage.summary.candidate_count,
    safe_auto_relink_count: relinkTriage.summary.safe_auto_relink_count,
    guessed_relink_count: relinkTriage.summary.guessed_relink_count,
    target_external_ready_count: handoff.external_ready_count,
  }, null, 2));
}

await main();
