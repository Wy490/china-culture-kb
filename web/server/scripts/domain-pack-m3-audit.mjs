import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..', '..', '..');
const sourcePath = resolve(repositoryRoot, 'data', 'domain-packs', 'china-culture.json');
const webServicePath = resolve(
  repositoryRoot,
  'web',
  'server',
  'src',
  'domains',
  'china-culture',
  'domain-pack-production-service.ts',
);
const promptServicePath = resolve(
  repositoryRoot,
  'web',
  'server',
  'src',
  'services',
  'story-generation-prompt.ts',
);
const mcpHealthPath = resolve(
  repositoryRoot,
  'mcp-server',
  'src',
  'tools',
  'production-health-reports.ts',
);
const reportPath = resolve(
  repositoryRoot,
  'data',
  'reports',
  'story-agent-writing-capability-m3-domain-pack-baseline.json',
);

const requiredPacks = [
  ['heritage_process_pack', '非遗流程生产包——材料工具、工序动作与授权边界'],
  ['documentary_source_pack', '纪录片来源包——现实现场、来源线索与再现边界'],
  ['ai_comic_storyboard_pack', 'AI漫剧分镜包——关键帧、表情节拍与连续性验收'],
  ['era_and_costume_pack', '朝代服饰与器物包——时代称谓、服装道具和事实边界'],
  ['ritual_etiquette_taboo_pack', '仪式礼俗与禁忌包——流程角色、空间秩序和文化边界'],
  ['architectural_space_furnishing_pack', '建筑空间与陈设包——空间层级、动线道具和时代边界'],
  ['regional_language_register_pack', '语言语体与地域表达包——人物身份、语境层级和方言边界'],
  ['natural_environment_soundscape_pack', '自然环境与声景包——季节天气、地貌运动和环境声音'],
  ['explainer_knowledge_structure_pack', '讲解知识结构包——核心问题、层级例子与图示字幕'],
  ['children_adaptation_safety_pack', '儿童改写规则包——年龄分层、善意张力与事实边界'],
  ['short_video_hook_pack', '短视频钩子包——三秒问题、对比反转与平台节奏'],
  ['education_training_structure_pack', '宣讲培训结构包——论点案例、练习复盘与行动转化'],
];
const ritualPackId = 'ritual_etiquette_taboo_pack';
const ritualEntryName = '仪式礼俗与禁忌包——流程角色、空间秩序和文化边界';
const expansionPackContracts = [
  {
    pack_id: 'architectural_space_furnishing_pack',
    entry_name: '建筑空间与陈设包——空间层级、动线道具和时代边界',
    domain: 'gears_asset',
    role: 'asset_pack',
    required_asset_usage: ['scene_space', 'scene_props', 'gears_delivery'],
    retrieval_marker: "seed.entry_name.includes('建筑空间与陈设包')",
  },
  {
    pack_id: 'regional_language_register_pack',
    entry_name: '语言语体与地域表达包——人物身份、语境层级和方言边界',
    domain: 'regional_culture',
    role: 'regional_pack',
    required_asset_usage: ['dialogue_tone', 'source_grounding', 'credibility_boundary'],
    retrieval_marker: "seed.entry_name.includes('语言语体与地域表达包')",
  },
  {
    pack_id: 'natural_environment_soundscape_pack',
    entry_name: '自然环境与声景包——季节天气、地貌运动和环境声音',
    domain: 'visual_style_pack',
    role: 'style_pack',
    required_asset_usage: ['scene_space', 'visual_style', 'gears_delivery'],
    retrieval_marker: "seed.entry_name.includes('自然环境与声景包')",
  },
];

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function nonBlankStrings(value) {
  return Array.isArray(value) && value.length > 0
    && value.every(item => typeof item === 'string' && item.trim().length > 0);
}

function addIssue(issues, condition, message) {
  if (!condition) issues.push(message);
}

const [source, webService, promptService, mcpHealth] = await Promise.all([
  readFile(sourcePath, 'utf8'),
  readFile(webServicePath, 'utf8'),
  readFile(promptServicePath, 'utf8'),
  readFile(mcpHealthPath, 'utf8'),
]);
const data = JSON.parse(source);
const entries = Array.isArray(data.entries) ? data.entries : [];
const entryByName = new Map(entries.map(entry => [entry.entry_name, entry]));
const issues = [];

const packSummaries = requiredPacks.map(([packId, entryName]) => {
  const entry = entryByName.get(entryName);
  const triggerWordCount = Array.isArray(entry?.trigger_words) ? entry.trigger_words.length : 0;
  const productionPromptCount = Array.isArray(entry?.production_prompts) ? entry.production_prompts.length : 0;
  const reviewBoundaryCount = Array.isArray(entry?.review_boundaries) ? entry.review_boundaries.length : 0;
  const assetUsageCount = Array.isArray(entry?.asset_usage) ? entry.asset_usage.length : 0;
  addIssue(issues, Boolean(entry), `missing required Domain Pack: ${packId}`);
  if (entry) {
    addIssue(issues, triggerWordCount >= 8, `${packId} requires at least 8 trigger words`);
    addIssue(issues, productionPromptCount >= 3, `${packId} requires at least 3 production prompts`);
    addIssue(issues, reviewBoundaryCount >= 3, `${packId} requires at least 3 review boundaries`);
    addIssue(issues, nonBlankStrings(entry.asset_usage), `${packId} requires non-blank asset usage`);
  }
  return {
    pack_id: packId,
    entry_name: entryName,
    trigger_word_count: triggerWordCount,
    production_prompt_count: productionPromptCount,
    review_boundary_count: reviewBoundaryCount,
    asset_usage_count: assetUsageCount,
    status: entry && triggerWordCount >= 8 && productionPromptCount >= 3 && reviewBoundaryCount >= 3
      ? 'passed'
      : 'failed',
  };
});

const ritual = entryByName.get(ritualEntryName);
addIssue(issues, data.domain_id === 'china_culture', 'unexpected Domain Pack domain_id');
addIssue(issues, data.version === '1.4.0', 'unexpected Domain Pack version');
addIssue(issues, data.updated_at === '2026-08-03', 'unexpected Domain Pack updated_at');
addIssue(issues, Boolean(ritual), 'ritual etiquette Domain Pack is missing');
addIssue(issues, ritual?.domain === 'safety_rule', 'ritual Domain Pack must use safety_rule domain');
addIssue(issues, ritual?.role === 'rule_pack', 'ritual Domain Pack must use rule_pack role');
addIssue(issues, ritual?.production_prompts?.length === 5, 'ritual Domain Pack must have 5 production prompts');
addIssue(issues, ritual?.review_boundaries?.length === 5, 'ritual Domain Pack must have 5 review boundaries');
for (const usage of ['scene_space', 'dialogue_tone', 'safety_boundary', 'source_grounding']) {
  addIssue(issues, ritual?.asset_usage?.includes(usage), `ritual Domain Pack missing asset usage: ${usage}`);
}
addIssue(issues, webService.includes("seed.entry_name.includes('仪式礼俗与禁忌包')"), 'Web retrieval priority is missing ritual pack');
addIssue(issues, promptService.includes('entry.production_prompts?.length'), 'story prompt does not consume production_prompts');
addIssue(issues, promptService.includes('entry.review_boundaries?.length'), 'story prompt does not consume review_boundaries');
for (const [packId] of requiredPacks) {
  addIssue(issues, webService.includes(`pack_id: '${packId}'`), `Web health contract is missing ${packId}`);
  addIssue(issues, mcpHealth.includes(`pack_id: '${packId}'`), `MCP health contract is missing ${packId}`);
}
for (const contract of expansionPackContracts) {
  const entry = entryByName.get(contract.entry_name);
  addIssue(issues, entry?.domain === contract.domain, `${contract.pack_id} has unexpected domain`);
  addIssue(issues, entry?.role === contract.role, `${contract.pack_id} has unexpected role`);
  addIssue(issues, entry?.production_prompts?.length === 5, `${contract.pack_id} must have 5 production prompts`);
  addIssue(issues, entry?.review_boundaries?.length === 5, `${contract.pack_id} must have 5 review boundaries`);
  for (const usage of contract.required_asset_usage) {
    addIssue(issues, entry?.asset_usage?.includes(usage), `${contract.pack_id} missing asset usage: ${usage}`);
  }
  addIssue(issues, webService.includes(contract.retrieval_marker), `Web retrieval priority is missing ${contract.pack_id}`);
}

const report = {
  schema_version: 'story-agent-writing-capability-m3-domain-pack-baseline/v1',
  generated_at: `${data.updated_at}T00:00:00.000+08:00`,
  status: issues.length === 0 ? 'passed' : 'failed',
  source: {
    path: 'data/domain-packs/china-culture.json',
    domain_id: data.domain_id,
    version: data.version,
    sha256: sha256(source),
  },
  gates: {
    required_production_pack_coverage: `${packSummaries.filter(pack => pack.status === 'passed').length}/${requiredPacks.length}`,
    minimum_trigger_words_per_pack: 8,
    minimum_production_prompts_per_pack: 3,
    minimum_review_boundaries_per_pack: 3,
    ritual_retrieval_registered: webService.includes("seed.entry_name.includes('仪式礼俗与禁忌包')"),
    expansion_retrieval_registered: Object.fromEntries(expansionPackContracts.map(contract => [
      contract.pack_id,
      webService.includes(contract.retrieval_marker),
    ])),
    story_prompt_consumes_production_prompts: promptService.includes('entry.production_prompts?.length'),
    story_prompt_consumes_review_boundaries: promptService.includes('entry.review_boundaries?.length'),
    web_health_contract_registered: webService.includes(`pack_id: '${ritualPackId}'`),
    mcp_health_contract_registered: mcpHealth.includes(`pack_id: '${ritualPackId}'`),
  },
  summary: {
    total_domain_pack_entry_count: entries.length,
    production_pack_count: packSummaries.length,
    production_ready_pack_count: packSummaries.filter(pack => pack.status === 'passed').length,
    ritual_pack_count: ritual ? 1 : 0,
    ritual_production_prompt_count: ritual?.production_prompts?.length ?? 0,
    ritual_review_boundary_count: ritual?.review_boundaries?.length ?? 0,
    expansion_pack_count: expansionPackContracts.length,
    expansion_production_prompt_count: expansionPackContracts.reduce((total, contract) => (
      total + (entryByName.get(contract.entry_name)?.production_prompts?.length ?? 0)
    ), 0),
    expansion_review_boundary_count: expansionPackContracts.reduce((total, contract) => (
      total + (entryByName.get(contract.entry_name)?.review_boundaries?.length ?? 0)
    ), 0),
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
    throw new Error(`M3 Domain Pack audit failed: ${issues.join('; ')}`);
  }
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

if (process.argv.includes('--check')) {
  const writtenReport = JSON.parse(await readFile(reportPath, 'utf8'));
  if (JSON.stringify(writtenReport) !== JSON.stringify(report)) {
    throw new Error('M3 Domain Pack baseline is stale; run with --write');
  }
}

console.log(JSON.stringify(report, null, 2));
if (report.status !== 'passed') process.exitCode = 1;
