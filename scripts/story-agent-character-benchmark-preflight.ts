import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getFullEntryDetail } from '../mcp-server/src/lib/markdown.js';
import { convertFullEntryDetail } from '../web/server/src/services/mcp-proxy.js';
import {
  buildCharacterStoryBenchmarkExecutionManifest,
  type CharacterStoryBenchmarkExecutionManifest,
} from '../web/server/src/services/professional-benchmark-service.js';

type JsonRecord = Record<string, unknown>;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = path.join(
  repoRoot,
  'data',
  'professional-benchmarks',
  'character-story-iteration3-benchmark-specs.json',
);
const outputPath = path.join(
  repoRoot,
  'data',
  'professional-benchmarks',
  'character-story-iteration3-execution-manifest.json',
);
const writeMode = process.argv.includes('--write');
const checkMode = process.argv.includes('--check');

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function readJson(filePath: string): Promise<JsonRecord> {
  const value = JSON.parse(await fs.readFile(filePath, 'utf8')) as unknown;
  if (!isRecord(value)) throw new Error(`Expected JSON object: ${filePath}`);
  return value;
}

async function buildManifest(): Promise<CharacterStoryBenchmarkExecutionManifest> {
  const registry = await readJson(registryPath);
  const projects = Array.isArray(registry.projects) ? registry.projects.filter(isRecord) : [];
  const entries = new Map();
  for (const project of projects) {
    const entryName = String(project.source_entry ?? '');
    const detail = await getFullEntryDetail(entryName);
    if (!detail) throw new Error(`Knowledge entry not found: ${entryName}`);
    entries.set(entryName, convertFullEntryDetail(detail));
  }
  const bridgeScriptPath = path.join(
    repoRoot,
    'web',
    'server',
    'scripts',
    'professional-character-benchmark-bridge.mjs',
  );
  const selectedModelCliPath = await findExecutable('claude');
  const bridgeAnchor = await inspectFileAnchor(bridgeScriptPath, constants.R_OK);
  const cliAnchor = await inspectFileAnchor(selectedModelCliPath, constants.X_OK);
  return buildCharacterStoryBenchmarkExecutionManifest({
    registry,
    entries,
    model_profile_id: 'claude_opus',
    runtime_inventory: {
      strict_bridge_manifest_path: bridgeScriptPath,
      strict_bridge_realpath: bridgeAnchor.realpath,
      strict_bridge_sha256: bridgeAnchor.sha256,
      strict_bridge_readable: bridgeAnchor.available,
      selected_model_cli_manifest_path: selectedModelCliPath,
      selected_model_cli_realpath: cliAnchor.realpath,
      selected_model_cli_sha256: cliAnchor.sha256,
      selected_model_cli_executable: cliAnchor.available,
    },
  });
}

async function inspectFileAnchor(
  filePath: string,
  mode: number,
): Promise<{ realpath: string | null; sha256: string | null; available: boolean }> {
  if (!filePath) return { realpath: null, sha256: null, available: false };
  try {
    const resolved = await fs.realpath(filePath);
    await fs.access(resolved, mode);
    const sha256 = createHash('sha256').update(await fs.readFile(resolved)).digest('hex');
    return { realpath: resolved, sha256, available: true };
  } catch {
    return { realpath: null, sha256: null, available: false };
  }
}

async function findExecutable(command: string): Promise<string> {
  const directories = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
  for (const directory of directories) {
    const candidate = path.join(directory, command);
    try {
      await fs.access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Continue through PATH without invoking the command or exposing credentials.
    }
  }
  return '';
}

function validateWrittenManifest(value: JsonRecord): void {
  if (value.schema_version === 'character-story-professional-benchmark-execution-manifest/v1') {
    throw new Error('legacy_generic_readiness_manifest_read_only_rebuild_v2');
  }
  if (value.schema_version !== 'character-story-professional-benchmark-execution-manifest/v2') {
    throw new Error('Invalid character_story benchmark execution manifest schema');
  }
  const policy = value.policy as JsonRecord;
  const summary = value.summary as JsonRecord;
  const packages = Array.isArray(value.packages) ? value.packages.filter(isRecord) : [];
  if (packages.length !== 5 || new Set(packages.map(item => item.benchmark_id)).size !== 5) {
    throw new Error('Expected 5 unique character_story execution packages');
  }
  if (summary.source_snapshot_ready_count !== 5
    || summary.strict_bridge_anchor_ready_count !== 5
    || summary.strict_cli_anchor_ready_count !== 5
    || summary.strict_technical_ready_count !== 5
    || summary.real_model_execution_ready_count !== 0
    || summary.fixed_real_model_project_count !== 0
    || summary.fixed_real_model_project_pass_count !== 0
    || summary.human_blind_review_pass_count !== 0
    || summary.professional_pass_count !== 0) {
    throw new Error('Benchmark execution manifest promoted unsupported professional evidence');
  }
  if (policy.invokes_model !== false
    || policy.writes_generated_story !== false
    || policy.source_snapshot_is_professional_pass !== false
    || policy.fixture_or_simulation_counts_as_real_run !== false) {
    throw new Error('Benchmark preflight policy must remain non-generating and evidence-safe');
  }
  const strictReadiness = value.strict_readiness as JsonRecord;
  if (strictReadiness.provider !== 'dedicated_strict_bridge'
    || strictReadiness.technical_ready !== true
    || strictReadiness.strict_bridge_readable !== true
    || strictReadiness.selected_model_cli_executable !== true
    || !/^[a-f0-9]{64}$/.test(String(strictReadiness.strict_bridge_sha256 ?? ''))
    || !/^[a-f0-9]{64}$/.test(String(strictReadiness.selected_model_cli_sha256 ?? ''))) {
    throw new Error('Dedicated strict bridge and CLI trust anchors must be technically ready');
  }
  for (const item of packages) {
    const sourceSnapshot = item.source_snapshot as JsonRecord;
    const executionContract = item.execution_contract as JsonRecord;
    if (!/^[a-f0-9]{64}$/.test(String(sourceSnapshot.snapshot_sha256 ?? ''))) {
      throw new Error(`Missing source snapshot hash: ${String(item.benchmark_id)}`);
    }
    if (sourceSnapshot.claim_level_verification_complete !== false
      || item.status !== 'source_package_ready'
      || executionContract.fallback_allowed_for_benchmark_credit !== false
      || executionContract.fixture_allowed_for_benchmark_credit !== false
      || item.professional_passed !== false) {
      throw new Error(`Unsafe benchmark promotion policy: ${String(item.benchmark_id)}`);
    }
  }
}

async function main(): Promise<void> {
  if (checkMode) {
    validateWrittenManifest(await readJson(outputPath));
    console.log('Character story professional benchmark execution manifest passed contract checks.');
    return;
  }
  const manifest = await buildManifest();
  validateWrittenManifest(manifest as unknown as JsonRecord);
  if (writeMode) {
    await fs.writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  }
  console.log(JSON.stringify({
    written: writeMode,
    fixed_project_spec_count: manifest.summary.fixed_project_spec_count,
    source_snapshot_ready_count: manifest.summary.source_snapshot_ready_count,
    strict_bridge_anchor_ready_count: manifest.summary.strict_bridge_anchor_ready_count,
    strict_cli_anchor_ready_count: manifest.summary.strict_cli_anchor_ready_count,
    strict_technical_ready_count: manifest.summary.strict_technical_ready_count,
    real_model_execution_ready_count: manifest.summary.real_model_execution_ready_count,
    fixed_real_model_project_count: manifest.summary.fixed_real_model_project_count,
    professional_pass_count: manifest.summary.professional_pass_count,
    strict_readiness: manifest.strict_readiness,
  }, null, 2));
}

void main();
