import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..', '..', '..');
const sourcePath = resolve(
  repositoryRoot,
  'data',
  'production-packs',
  'video-type-material-supplement-packs.json',
);
const reportPath = resolve(
  repositoryRoot,
  'data',
  'reports',
  'story-agent-writing-capability-m3-production-material-baseline.json',
);
const productionAuditPath = resolve(
  repositoryRoot,
  'data',
  'reports',
  'knowledge-base-production-audit.json',
);

const expectedVideoTypes = [
  'character_story',
  'historical_drama',
  'legend_story',
  'culture_promo',
  'heritage_promo',
  'city_brand_promo',
  'scene_short',
  'landscape_mood',
  'documentary_short',
  'explainer_video',
  'lecture_video',
  'education_training',
  'children_story',
  'social_short',
  'ai_comic_drama',
].sort();

const expansionVideoTypes = new Set([
  'character_story',
  'historical_drama',
  'legend_story',
  'culture_promo',
  'city_brand_promo',
  'scene_short',
  'landscape_mood',
]);

function nonBlank(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function issue(issues, condition, message) {
  if (!condition) issues.push(message);
}

function auditPack(pack, issues) {
  const template = pack?.material_template ?? {};
  const samples = Array.isArray(pack?.sample_entries) ? pack.sample_entries : [];
  const regions = new Set(samples.map(sample => sample.regional_anchor).filter(nonBlank));

  issue(issues, nonBlank(pack?.video_type), 'pack video_type must be non-blank');
  issue(issues, nonBlank(pack?.label), `${pack?.video_type ?? 'unknown'} label must be non-blank`);
  issue(issues, Array.isArray(template.required_fields) && template.required_fields.length >= 10,
    `${pack?.video_type} requires at least 10 material fields`);
  issue(issues, Array.isArray(template.prompt_layers) && template.prompt_layers.length >= 4,
    `${pack?.video_type} requires at least 4 prompt layers`);
  issue(issues, Array.isArray(template.supplement_questions) && template.supplement_questions.length >= 4,
    `${pack?.video_type} requires at least 4 supplement questions`);
  for (const gate of ['minimum_viable_story_gate', 'script_ready_gate', 'production_ready_gate']) {
    issue(issues, Array.isArray(template[gate]) && template[gate].length >= 3,
      `${pack?.video_type} ${gate} requires at least 3 items`);
  }
  issue(issues, samples.length >= 5, `${pack?.video_type} requires at least 5 samples`);

  if (expansionVideoTypes.has(pack?.video_type)) {
    issue(issues, regions.size >= 4, `${pack.video_type} requires at least 4 regional anchors`);
    issue(issues, samples.every(sample => nonBlank(sample.failure_pattern)),
      `${pack.video_type} samples require failure_pattern`);
    issue(issues, samples.every(sample => nonBlank(sample.repair_strategy)),
      `${pack.video_type} samples require repair_strategy`);
  }

  return {
    video_type: pack?.video_type,
    required_field_count: template.required_fields?.length ?? 0,
    prompt_layer_count: template.prompt_layers?.length ?? 0,
    sample_count: samples.length,
    regional_anchor_count: regions.size,
    failure_repair_sample_count: samples.filter(sample => (
      nonBlank(sample.failure_pattern) && nonBlank(sample.repair_strategy)
    )).length,
  };
}

const source = await readFile(sourcePath, 'utf8');
const sourceSha256 = createHash('sha256').update(source).digest('hex');
const data = JSON.parse(source);
const productionAudit = JSON.parse(await readFile(productionAuditPath, 'utf8'));
const packs = Array.isArray(data.packs) ? data.packs : [];
const issues = [];
const actualVideoTypes = packs.map(pack => pack.video_type).sort();
const duplicateVideoTypes = actualVideoTypes.filter(
  (videoType, index) => actualVideoTypes.indexOf(videoType) !== index,
);
const packSummaries = packs.map(pack => auditPack(pack, issues));
const totalRequiredFieldCount = packSummaries.reduce(
  (total, pack) => total + pack.required_field_count,
  0,
);

issue(issues, data.schema_version === 'video-type-material-supplement-packs/v1',
  'unexpected production material source schema');
issue(issues, JSON.stringify(actualVideoTypes) === JSON.stringify(expectedVideoTypes),
  'production material packs must cover the exact 15 VideoType catalog');
issue(issues, duplicateVideoTypes.length === 0, 'production material video_type values must be unique');
issue(issues, totalRequiredFieldCount >= 184, 'total required field count must be at least 184');
issue(issues, productionAudit.schema_version === 'kb-production-material-audit/v1',
  'unexpected production audit schema');
issue(issues, productionAudit.totals?.raw_missing_production_field_count >= 0,
  'production audit must expose raw production field gaps');
issue(issues, productionAudit.totals?.machine_guidance_field_count >= 0,
  'production audit must expose machine guidance coverage');
issue(issues, productionAudit.totals?.effective_missing_production_field_count === 0,
  'runtime production guidance must cover all currently derivable base field gaps');
issue(issues, productionAudit.entries?.every(entry => entry.type_template_audits?.length === 15),
  'every production-audited entry must be checked against all 15 VideoType templates');

const report = {
  schema_version: 'story-agent-writing-capability-m3-production-material-baseline/v1',
  generated_at: `${data.updated_at}T00:00:00.000+08:00`,
  status: issues.length === 0 ? 'passed' : 'failed',
  source: {
    path: 'data/production-packs/video-type-material-supplement-packs.json',
    schema_version: data.schema_version,
    sha256: sourceSha256,
    production_audit_path: 'data/reports/knowledge-base-production-audit.json',
    production_audit_schema_version: productionAudit.schema_version,
    production_audit_generated_at: productionAudit.generated_at,
  },
  gates: {
    video_type_coverage: `${actualVideoTypes.length}/15`,
    minimum_samples_per_type: 5,
    minimum_fields_per_type: 10,
    minimum_prompt_layers_per_type: 4,
    minimum_regional_anchors_for_expansion_pack: 4,
    failure_repair_required_for_expansion_samples: true,
    type_template_audits_per_entry: 15,
    effective_runtime_base_field_gap_target: 0,
  },
  summary: {
    pack_count: packs.length,
    total_required_field_count: totalRequiredFieldCount,
    total_sample_count: packSummaries.reduce((total, pack) => total + pack.sample_count, 0),
    expansion_pack_count: packSummaries.filter(pack => expansionVideoTypes.has(pack.video_type)).length,
    lecture_video_sample_count: packSummaries.find(pack => pack.video_type === 'lecture_video')?.sample_count ?? 0,
    education_training_sample_count: packSummaries.find(pack => pack.video_type === 'education_training')?.sample_count ?? 0,
    production_audited_entry_count: productionAudit.totals?.entries ?? 0,
    raw_source_production_field_gap_count: productionAudit.totals?.raw_missing_production_field_count ?? 0,
    machine_guidance_field_count: productionAudit.totals?.machine_guidance_field_count ?? 0,
    effective_runtime_production_field_gap_count: productionAudit.totals?.effective_missing_production_field_count ?? 0,
    entries_with_machine_guidance: productionAudit.totals?.entries_with_machine_guidance ?? 0,
  },
  packs: packSummaries,
  issues,
  boundaries: {
    province_markdown_written: false,
    human_review_credit_claimed: false,
    user_registration_required: false,
    third_party_code_executed: false,
  },
};

if (process.argv.includes('--write')) {
  if (report.status !== 'passed') {
    throw new Error(`M3 production material audit failed: ${issues.join('; ')}`);
  }
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

if (process.argv.includes('--check')) {
  const writtenReport = JSON.parse(await readFile(reportPath, 'utf8'));
  if (JSON.stringify(writtenReport) !== JSON.stringify(report)) {
    throw new Error('M3 production material baseline is stale; run with --write');
  }
}

console.log(JSON.stringify(report, null, 2));
if (report.status !== 'passed') process.exitCode = 1;
