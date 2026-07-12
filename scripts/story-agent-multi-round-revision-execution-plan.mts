import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildMultiRoundRevisionExecutionManifest,
  validateMultiRoundRevisionExecutionManifest,
  type MultiRoundRevisionExecutionManifest,
  type MultiRoundRevisionSpecRegistry,
} from '../web/server/src/services/professional-multi-round-revision-execution-service.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = path.join(repoRoot, 'data/professional-benchmarks/all-format-stage6-iteration1-multi-round-revision-specs.json');
const manifestPath = path.join(repoRoot, 'data/professional-benchmarks/all-format-stage6-iteration2-execution-manifest.json');
const writeMode = process.argv.includes('--write');
const checkMode = process.argv.includes('--check');

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
}

async function main(): Promise<void> {
  if (checkMode) {
    const manifest = await readJson<MultiRoundRevisionExecutionManifest>(manifestPath);
    const errors = validateMultiRoundRevisionExecutionManifest(manifest);
    if (errors.length > 0) throw new Error(`Stage 6 execution manifest invalid: ${errors.join(',')}`);
    if (manifest.summary.project_spec_count !== 15
      || manifest.summary.planned_revision_round_count !== 30
      || manifest.summary.blocked_project_count !== 15
      || manifest.summary.ready_for_round_1_project_count !== 0) {
      throw new Error('Stage 6 execution manifest must remain fail-closed until external inputs exist');
    }
    console.log('Stage 6 multi-round revision execution manifest passed contract checks.');
    return;
  }
  const registry = await readJson<MultiRoundRevisionSpecRegistry>(registryPath);
  const manifest = buildMultiRoundRevisionExecutionManifest({ registry });
  const errors = validateMultiRoundRevisionExecutionManifest(manifest);
  if (errors.length > 0) throw new Error(`Stage 6 execution manifest invalid: ${errors.join(',')}`);
  if (writeMode) await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    written: writeMode,
    manifest_path: path.relative(repoRoot, manifestPath),
    summary: manifest.summary,
  }, null, 2));
}

void main();
