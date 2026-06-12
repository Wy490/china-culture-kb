import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const provincesDir = path.join(repoRoot, 'data', 'provinces');

const allowedDomains = new Set([
  'core_china_culture',
  'era_setting',
  'regional_culture',
  'folklore_zhiyi',
  'gears_asset',
]);

const allowedRoles = new Set([
  'core_entry',
  'setting_pack',
  'motif_pack',
  'asset_pack',
  'regional_pack',
]);

const allowedUsage = new Set([
  'character_clothing',
  'character_props',
  'scene_space',
  'scene_props',
  'story_motif',
  'dialogue_tone',
  'credibility_boundary',
  'gears_delivery',
]);

const requiredBaseFields = ['省份', '地区', '类型'];
const requiredSections = ['简介', '故事梗概', '文化意义', '相关地点', '关键词', '来源', '核实方法', '待核实点'];
const requiredAssetSections = ['人物', '场景', '人物随身道具', '场景陈设'];
const sourceGradePattern = /[ABCD]级/;
const boundaryPattern = /(待核实|混合标注|不等同确证史实|不等同史实)/;
const localRelationPattern = /^(直接事件|相关地点|思想文化影响|当代转化|不可写成)[｜|].+?：.+$/;

const errors = [];
let checkedFiles = 0;
let checkedEntries = 0;
let enrichedEntries = 0;

function report(file, entry, message) {
  errors.push(`${file}${entry ? ` :: ${entry}` : ''} - ${message}`);
}

function getHeaderField(entryText, fieldName) {
  const match = entryText.match(new RegExp(`^- \\*\\*${escapeRegex(fieldName)}\\*\\*：(.+)$`, 'm'));
  return match?.[1]?.trim();
}

function hasSection(entryText, sectionName) {
  return new RegExp(`^### ${escapeRegex(sectionName)}(?:\\s*$|\\n)`, 'm').test(entryText);
}

function getSection(entryText, sectionName) {
  const match = entryText.match(new RegExp(`^### ${escapeRegex(sectionName)}\\n\\n([\\s\\S]*?)(?=\\n### |\\n## |\\n---\\n|$)`, 'm'));
  return match?.[1]?.trim() ?? '';
}

function splitList(raw) {
  return raw
    .split(/[、，,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitEntries(content) {
  const marker = '## 已整理条目';
  const markerIndex = content.indexOf(marker);
  if (markerIndex === -1) {
    return { entries: [], missingMarker: true };
  }

  return {
    entries: content
      .slice(markerIndex + marker.length)
      .split(/\n---\n/)
      .map((entry) => entry.trim())
      .filter((entry) => /^## .+/m.test(entry)),
    missingMarker: false,
  };
}

function getEntryName(entryText) {
  return entryText.match(/^## (.+)$/m)?.[1]?.trim() ?? '(未命名条目)';
}

function isEnriched(entryText) {
  return ['knowledge_domain', 'entry_role', 'era', 'asset_usage'].some((field) => getHeaderField(entryText, field))
    || requiredAssetSections.some((section) => hasSection(entryText, section));
}

function checkSourceGrades(file, entryName, entryText) {
  const sourceText = getSection(entryText, '来源');
  const sourceLines = sourceText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '));

  if (sourceLines.length === 0) {
    report(file, entryName, '来源 section must include list items');
    return;
  }

  for (const line of sourceLines) {
    const isInternalReference = /本文件|本项目/.test(line);
    if (!isInternalReference && !sourceGradePattern.test(line)) {
      report(file, entryName, `source line is missing grade: ${line}`);
    }
  }
}

function checkMachineFields(file, entryName, entryText) {
  const domain = getHeaderField(entryText, 'knowledge_domain');
  const role = getHeaderField(entryText, 'entry_role');
  const era = getHeaderField(entryText, 'era');
  const assetUsageRaw = getHeaderField(entryText, 'asset_usage');

  if (!domain) report(file, entryName, 'missing knowledge_domain');
  if (!role) report(file, entryName, 'missing entry_role');
  if (!era) report(file, entryName, 'missing era');
  if (!assetUsageRaw) report(file, entryName, 'missing asset_usage');

  if (domain && !allowedDomains.has(domain)) {
    report(file, entryName, `unknown knowledge_domain: ${domain}`);
  }

  if (role && !allowedRoles.has(role)) {
    report(file, entryName, `unknown entry_role: ${role}`);
  }

  if (assetUsageRaw) {
    for (const usage of splitList(assetUsageRaw)) {
      if (!allowedUsage.has(usage)) {
        report(file, entryName, `unknown asset_usage: ${usage}`);
      }
    }
  }
}

function checkLocalCreativeRelations(file, entryName, entryText) {
  if (!hasSection(entryText, '地方化创作关系')) return;

  const localText = getSection(entryText, '地方化创作关系');
  const lines = localText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const relationLines = lines.filter((line) => line.startsWith('- '));
  if (relationLines.length === 0) {
    report(file, entryName, '地方化创作关系 section must include list items');
    return;
  }

  for (const line of relationLines) {
    const cleaned = line.replace(/^- /, '').trim();
    if (!localRelationPattern.test(cleaned)) {
      report(file, entryName, `invalid 地方化创作关系 line: ${line}`);
    }
  }
}

function checkEntry(file, entryText) {
  const entryName = getEntryName(entryText);
  checkedEntries += 1;

  if (!isEnriched(entryText)) return;

  enrichedEntries += 1;

  for (const field of requiredBaseFields) {
    if (!getHeaderField(entryText, field)) {
      report(file, entryName, `missing base field: ${field}`);
    }
  }

  for (const section of requiredSections) {
    if (!hasSection(entryText, section)) {
      report(file, entryName, `missing section: ${section}`);
    }
  }

  if (!hasSection(entryText, '可信度') && !hasSection(entryText, '可信度与核实')) {
    report(file, entryName, 'missing section: 可信度');
  }

  for (const section of requiredAssetSections) {
    if (!hasSection(entryText, section)) {
      report(file, entryName, `missing asset section: ${section}`);
    }
  }

  checkMachineFields(file, entryName, entryText);
  checkSourceGrades(file, entryName, entryText);
  checkLocalCreativeRelations(file, entryName, entryText);

  const domain = getHeaderField(entryText, 'knowledge_domain');
  const type = getHeaderField(entryText, '类型') ?? '';
  const boundaryText = [
    getSection(entryText, '可信度'),
    getSection(entryText, '可信度与核实'),
    getSection(entryText, '核实方法'),
    getSection(entryText, '待核实点'),
  ].join('\n');

  if ((domain === 'folklore_zhiyi' || /传说|志异|狐仙|遇异|悟道/.test(`${entryName}${type}`)) && !boundaryPattern.test(boundaryText)) {
    report(file, entryName, 'folklore or zhiyi entry is missing clear credibility boundary');
  }
}

function checkSourceIndex(file, content) {
  for (const sourceId of ['S46', 'S47', 'S48', 'S49', 'S50', 'S51', 'S52']) {
    const line = content.split('\n').find((item) => item.startsWith(`[${sourceId}]`));
    if (line && !sourceGradePattern.test(line)) {
      report(file, null, `[${sourceId}] source index line is missing grade`);
    }
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const files = (await fs.readdir(provincesDir))
  .filter((file) => file.endsWith('.md'))
  .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));

for (const file of files) {
  const filePath = path.join(provincesDir, file);
  const content = await fs.readFile(filePath, 'utf8');
  checkedFiles += 1;

  const { entries, missingMarker } = splitEntries(content);
  if (missingMarker) {
    report(file, null, 'missing ## 已整理条目 section');
    continue;
  }

  checkSourceIndex(file, content);
  for (const entry of entries) {
    checkEntry(file, entry);
  }
}

if (errors.length > 0) {
  console.error(`kb:lint found ${errors.length} issue(s):`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`kb:lint passed: ${checkedFiles} files, ${checkedEntries} entries, ${enrichedEntries} enriched entries checked`);
